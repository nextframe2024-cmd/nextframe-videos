/**
 * Appends WhatsApp leads to the sheet.
 *
 * Deployed as a web app; the Cloudflare Worker POSTs batches of leads to its
 * /exec URL. The pure parts live in logic.gs, which the test suite covers.
 *
 * Setup:
 *   1. Add both logic.gs and this file to the Apps Script project.
 *   2. Replace TOKEN with a long random string (`openssl rand -hex 32`).
 *   3. Deploy > New deployment > Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *   4. Give the /exec URL to the Worker as SHEETS_WEBAPP_URL, and the same
 *      TOKEN as SHEETS_TOKEN.
 *
 * Apps Script serves a snapshot, so any change here needs a NEW deployment.
 * Sheet headers do not: they are read on every request.
 */

var SPREADSHEET_ID = '1G3GFq0xzWbyKB2yA1MPD4bAl8WDhQjI3BDUCysBfdZE';

// A web app set to "Anyone" is reachable by anyone who learns the URL, so this
// shared secret is what actually keeps strangers out of the sheet.
var TOKEN = 'REPLACE_WITH_A_LONG_RANDOM_STRING';

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * The wa_message_ids already in the sheet.
 *
 * The Worker only marks a lead written once this script answers ok, so any
 * failure after the rows commit — a timeout, a dropped response — leaves Meta
 * retrying a batch that is already here. Reading the id column before writing
 * is what makes that retry idempotent.
 */
function existingIds_(sheet, idColumn) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {}; // Header only.
  return idLookup_(sheet.getRange(2, idColumn, lastRow - 1, 1).getValues());
}

/**
 * A liveness check, so the deployment can be confirmed without writing a row.
 *
 * Reconstructed from what the live /exec returns; the editor is the original.
 * It existed there while this file did not have it, which meant the suite was
 * covering a different script from the one the Worker talks to.
 */
function doGet() {
  return jsonOut({ ok: true, service: 'whatsapp-leads-sink' });
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'bad json' });
  }

  if (!TOKEN || TOKEN === 'REPLACE_WITH_A_LONG_RANDOM_STRING') {
    return jsonOut({ ok: false, error: 'token_not_configured' });
  }
  if (payload.token !== TOKEN) {
    return jsonOut({ ok: false, error: 'unauthorized' });
  }

  var batch = selectBatch_(payload);
  if (batch.error) return jsonOut({ ok: false, error: batch.error });

  var leads = batch.leads;
  if (leads.length === 0) {
    return jsonOut({ ok: true, appended: 0, skipped: 0, received: 0 });
  }

  // Covers the read and the write together: two deliveries arriving at once
  // would otherwise both compute the same target row.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return jsonOut({ ok: false, error: 'busy' });
  }

  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    var idColumn = findIdColumn_(headers);
    var fresh = leads;
    var warning;

    if (idColumn > 0) {
      fresh = filterFresh_(leads, existingIds_(sheet, idColumn));
    } else {
      // Dedupe is a safety net, not a gate: still write, but say it is off.
      warning = 'no wa_message_id column in header row — dedupe disabled';
    }

    var skipped = leads.length - fresh.length;
    if (fresh.length === 0) {
      return jsonOut({
        ok: true,
        appended: 0,
        skipped: skipped,
        received: leads.length,
        sheet: sheet.getName(),
      });
    }

    var rows = mapRows_(fresh, headers);

    // One setValues for the whole batch, so a batch cannot land half written.
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length)
      .setValues(rows);

    var result = {
      ok: true,
      appended: rows.length,
      skipped: skipped,
      received: leads.length,
      sheet: sheet.getName(),
    };
    if (warning) result.warning = warning;
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
