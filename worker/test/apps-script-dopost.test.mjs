import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Exercises doPost from Code.gs against stubbed Apps Script globals.
 *
 * logic.gs is covered separately; this covers the parts that only exist inside
 * the script runtime — the token gate, the lock, and how the dedupe read is
 * wired to the write.
 */
const read = (name) =>
  readFileSync(new URL(`../../apps-script/${name}`, import.meta.url), 'utf8');

const LOGIC = read('logic.gs');
const CODE = read('Code.gs');

const HEADERS = ['received_at', 'wa_message_id', 'from', 'text', 'status', 'notes'];

/** A sheet backed by an array of rows, row 1 being the header. */
function fakeSheet(rows) {
  return {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => rows[0].length,
    getRange(row, col, numRows, numCols) {
      return {
        getValues: () =>
          rows
            .slice(row - 1, row - 1 + numRows)
            .map((r) => r.slice(col - 1, col - 1 + numCols)),
        setValues: (values) => {
          values.forEach((v, i) => {
            rows[row - 1 + i] = v;
          });
        },
      };
    },
  };
}

/**
 * Loads both script files with the globals they expect, and optionally
 * overrides TOKEN — the file ships with the placeholder that refuses to write.
 */
function load(sheet, { token } = {}) {
  const override = token === undefined ? '' : `\nTOKEN = ${JSON.stringify(token)};`;
  return new Function(
    'ContentService',
    'SpreadsheetApp',
    'LockService',
    `${LOGIC}\n${CODE}${override}\nreturn doPost;`,
  )(
    {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ setMimeType: () => text }),
    },
    { openById: () => ({ getSheets: () => [sheet] }) },
    { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  );
}

const post = (doPost, body) =>
  JSON.parse(doPost({ postData: { contents: JSON.stringify(body) } }));

const lead = (id, text) => ({
  received_at: '2026-09-20T12:00:00.000Z',
  wa_message_id: id,
  from: '972524343190',
  text,
});

test('refuses to write while TOKEN is the placeholder', () => {
  const sheet = fakeSheet([HEADERS.slice()]);
  const result = post(load(sheet), { token: 'anything', leads: [lead('wamid.A', 'hi')] });

  assert.deepEqual(result, { ok: false, error: 'token_not_configured' });
  assert.equal(sheet.rows.length, 1); // Header only.
});

test('rejects a wrong token', () => {
  const sheet = fakeSheet([HEADERS.slice()]);
  const result = post(load(sheet, { token: 'right' }), {
    token: 'wrong',
    leads: [lead('wamid.A', 'hi')],
  });

  assert.deepEqual(result, { ok: false, error: 'unauthorized' });
  assert.equal(sheet.rows.length, 1);
});

test('rejects a body that is not JSON', () => {
  const doPost = load(fakeSheet([HEADERS.slice()]), { token: 'right' });
  const result = JSON.parse(doPost({ postData: { contents: 'not json' } }));

  assert.deepEqual(result, { ok: false, error: 'bad json' });
});

test('rejects a payload with no recognized batch key', () => {
  const sheet = fakeSheet([HEADERS.slice()]);
  const result = post(load(sheet, { token: 'right' }), { token: 'right' });

  assert.equal(result.ok, false);
  assert.match(result.error, /no leads, messages or message/);
  assert.equal(sheet.rows.length, 1);
});

test('appends a lead in the sheet column order', () => {
  const sheet = fakeSheet([HEADERS.slice()]);
  const result = post(load(sheet, { token: 'right' }), {
    token: 'right',
    leads: [lead('wamid.A', 'מחפש הצעה')],
  });

  assert.deepEqual(result, { ok: true, appended: 1, skipped: 0, received: 1 });
  assert.equal(sheet.rows.length, 2);

  const row = sheet.rows[1];
  assert.equal(row[HEADERS.indexOf('wa_message_id')], 'wamid.A');
  assert.equal(row[HEADERS.indexOf('text')], 'מחפש הצעה');
  assert.equal(row[HEADERS.indexOf('status')], '');
});

test('a retried delivery appends nothing', () => {
  // The case KV cannot catch: the rows committed but the response was lost.
  const sheet = fakeSheet([HEADERS.slice()]);
  const doPost = load(sheet, { token: 'right' });
  const body = { token: 'right', leads: [lead('wamid.A', 'hi')] };

  assert.deepEqual(post(doPost, body), { ok: true, appended: 1, skipped: 0, received: 1 });
  assert.deepEqual(post(doPost, body), { ok: true, appended: 0, skipped: 1, received: 1 });
  assert.equal(sheet.rows.length, 2);
});

test('appends only the unseen leads of a partly retried batch', () => {
  const sheet = fakeSheet([HEADERS.slice()]);
  const doPost = load(sheet, { token: 'right' });

  post(doPost, { token: 'right', leads: [lead('wamid.A', 'first')] });
  const result = post(doPost, {
    token: 'right',
    leads: [lead('wamid.A', 'first'), lead('wamid.B', 'second')],
  });

  assert.deepEqual(result, { ok: true, appended: 1, skipped: 1, received: 2 });
  assert.equal(sheet.rows.length, 3);
});

test('still writes without a dedupe column, and says dedupe is off', () => {
  const sheet = fakeSheet([['received_at', 'text']]);
  const result = post(load(sheet, { token: 'right' }), {
    token: 'right',
    leads: [lead('wamid.A', 'hi')],
  });

  assert.equal(result.ok, true);
  assert.equal(result.appended, 1);
  assert.match(result.warning, /no wa_message_id column/);
});

test('an empty batch is a success with nothing appended', () => {
  const sheet = fakeSheet([HEADERS.slice()]);
  const result = post(load(sheet, { token: 'right' }), { token: 'right', leads: [] });

  assert.deepEqual(result, { ok: true, appended: 0, skipped: 0, received: 0 });
  assert.equal(sheet.rows.length, 1);
});

test('accepts the messages and message aliases', () => {
  const sheet = fakeSheet([HEADERS.slice()]);
  const doPost = load(sheet, { token: 'right' });

  assert.equal(post(doPost, { token: 'right', messages: [lead('wamid.A', 'a')] }).appended, 1);
  assert.equal(post(doPost, { token: 'right', message: lead('wamid.B', 'b') }).appended, 1);
  assert.equal(sheet.rows.length, 3);
});

test('dedupes after the key column is physically moved', () => {
  // A silently wrong dedupe — comparing ids against received_at — is worse
  // than none, so the column is located by header on every request.
  const moved = ['wa_message_id', 'received_at', 'from', 'text', 'status', 'notes'];
  const sheet = fakeSheet([moved]);
  const doPost = load(sheet, { token: 'right' });
  const body = { token: 'right', leads: [lead('wamid.A', 'hi')] };

  assert.equal(post(doPost, body).appended, 1);
  assert.equal(sheet.rows[1][0], 'wamid.A'); // Column A now holds the key.

  const retry = post(doPost, body);
  assert.deepEqual(retry, { ok: true, appended: 0, skipped: 1, received: 1 });
  assert.equal(sheet.rows.length, 2);
});
