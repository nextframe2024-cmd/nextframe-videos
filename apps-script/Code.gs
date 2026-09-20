/**
 * Appends WhatsApp leads to the sheet.
 *
 * Deployed as a web app; the Cloudflare Worker POSTs batches of leads to its
 * /exec URL. Rows are mapped by header name, so reordering or adding columns
 * in the sheet needs no change here.
 *
 * Setup:
 *   1. Replace TOKEN with a long random string.
 *   2. Deploy > New deployment > Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *   3. Give the /exec URL to the Worker as SHEETS_WEBAPP_URL, and the same
 *      TOKEN as SHEETS_TOKEN.
 */

var SPREADSHEET_ID = '1G3GFq0xzWbyKB2yA1MPD4bAl8WDhQjI3BDUCysBfdZE';

// A web app set to "Anyone" is reachable by anyone who learns the URL, so this
// shared secret is what actually keeps strangers from writing to the sheet.
var TOKEN = 'REPLACE_WITH_A_LONG_RANDOM_STRING';

/**
 * The wa_message_ids already in the sheet.
 *
 * The Worker only marks a lead written once this script answers ok, so any
 * failure after the rows commit — a timeout, a dropped response — leaves Meta
 * retrying a batch that is already in the sheet. Reading the id column before
 * writing is what makes a retry idempotent.
 */
function existingIds_(sheet, idColumn) {
  var seen = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return seen; // Header only.

  var values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var id = values[i][0];
    if (id) seen[String(id)] = true;
  }
  return seen;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'bad json' });
  }

  if (!TOKEN || TOKEN === 'REPLACE_WITH_A_LONG_RANDOM_STRING') {
    return jsonOut({ ok: false, error: 'token not configured' });
  }
  if (payload.token !== TOKEN) {
    return jsonOut({ ok: false, error: 'unauthorized' });
  }

  // Accepts `leads` or `messages` for a batch, or a single `message` object.
  // A payload carrying none of these is a contract mismatch, not an empty
  // batch: reporting ok here would let the Worker mark the lead written and
  // drop it, so it has to be an error.
  var leads;
  if (Array.isArray(payload.leads)) {
    leads = payload.leads;
  } else if (Array.isArray(payload.messages)) {
    leads = payload.messages;
  } else if (payload.message && typeof payload.message === 'object') {
    leads = [payload.message];
  } else {
    return jsonOut({ ok: false, error: 'no leads, messages or message in payload' });
  }

  if (leads.length === 0) {
    return jsonOut({ ok: true, appended: 0 });
  }

  // Two deliveries arriving together would otherwise compute the same target
  // row and overwrite each other.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return jsonOut({ ok: false, error: 'busy' });
  }

  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Header names are read per request, so reordering or adding columns in
    // the sheet needs no redeployment.
    var idColumn = headers.indexOf('wa_message_id') + 1;
    var fresh = leads;
    var warning;

    if (idColumn > 0) {
      var seen = existingIds_(sheet, idColumn);
      fresh = leads.filter(function (lead) {
        return !seen[String(lead.wa_message_id)];
      });
    } else {
      // Dedupe is a safety net, not a gate: still write, but say it is off.
      warning = 'no wa_message_id column, retries may duplicate rows';
    }

    var skipped = leads.length - fresh.length;
    if (fresh.length === 0) {
      return jsonOut({ ok: true, appended: 0, skipped: skipped });
    }

    var rows = fresh.map(function (lead) {
      return headers.map(function (header) {
        var value = lead[header];
        return value === undefined || value === null ? '' : value;
      });
    });

    // One setValues for the whole batch, so a batch cannot land half written.
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length)
      .setValues(rows);

    var result = { ok: true, appended: rows.length, skipped: skipped };
    if (warning) result.warning = warning;
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
