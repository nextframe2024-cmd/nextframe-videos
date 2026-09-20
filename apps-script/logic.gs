/**
 * Pure helpers for the sheet sink.
 *
 * Plain function declarations and no module syntax on purpose: Apps Script
 * concatenates every file in a project, and the test suite evaluates this
 * file verbatim. The tests therefore cover the source that actually deploys.
 */

/**
 * Picks the lead batch out of a request body.
 *
 * Accepts `leads` or `messages` for a batch and `message` for a single lead,
 * so an independently built Worker interoperates. A body carrying none of
 * them is a contract mismatch rather than an empty batch — reporting success
 * there would let the Worker mark the lead written and drop it.
 */
function selectBatch_(payload) {
  if (!payload || typeof payload !== 'object') {
    return { error: 'body is not an object' };
  }
  if (Array.isArray(payload.leads)) return { leads: payload.leads };
  if (Array.isArray(payload.messages)) return { leads: payload.messages };
  if (payload.message && typeof payload.message === 'object') {
    return { leads: [payload.message] };
  }
  return { error: 'no leads, messages or message in payload' };
}

/** 1-based column of the dedupe key, or 0 when the sheet has no such column. */
function findIdColumn_(headers) {
  if (!Array.isArray(headers)) return 0;
  return headers.indexOf('wa_message_id') + 1;
}

/** Drops leads whose id is already in the sheet, making a retry a no-op. */
function filterFresh_(leads, seenIds) {
  return leads.filter(function (lead) {
    var id = lead && lead.wa_message_id;
    // A lead with no id cannot be deduped; let it through rather than lose it.
    if (!id) return true;
    return !seenIds[String(id)];
  });
}

/** Lays each lead out in the sheet's own column order, by header name. */
function mapRows_(leads, headers) {
  return leads.map(function (lead) {
    return headers.map(function (header) {
      var value = lead ? lead[header] : undefined;
      return value === undefined || value === null ? '' : value;
    });
  });
}

/** Turns a column of ids into a lookup, skipping blanks. */
function idLookup_(values) {
  var seen = {};
  for (var i = 0; i < values.length; i++) {
    var id = values[i][0];
    if (id) seen[String(id)] = true;
  }
  return seen;
}
