import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Evaluates apps-script/logic.gs verbatim, so these tests cover the file that
 * actually deploys rather than a copy of its logic.
 *
 * A plain Function rather than node:vm, so the values it returns are ordinary
 * host arrays and objects — a separate vm realm gives them foreign prototypes
 * and every deepStrictEqual against them fails on prototype alone.
 */
const source = readFileSync(
  new URL('../../apps-script/logic.gs', import.meta.url),
  'utf8',
);
const { selectBatch_, findIdColumn_, filterFresh_, mapRows_, idLookup_ } =
  new Function(
    source +
      '\nreturn { selectBatch_, findIdColumn_, filterFresh_, mapRows_, idLookup_ };',
  )();

const HEADERS = [
  'received_at',
  'wa_message_id',
  'from',
  'name',
  'type',
  'text',
  'media_id',
  'location',
  'phone_number_id',
  'status',
  'notes',
];

test('takes a batch from leads, messages or a single message', () => {
  assert.deepEqual(selectBatch_({ leads: [{ a: 1 }] }), { leads: [{ a: 1 }] });
  assert.deepEqual(selectBatch_({ messages: [{ a: 2 }] }), { leads: [{ a: 2 }] });
  assert.deepEqual(selectBatch_({ message: { a: 3 } }), { leads: [{ a: 3 }] });
});

test('an empty array is an empty batch, not an error', () => {
  assert.deepEqual(selectBatch_({ leads: [] }), { leads: [] });
});

test('a body with no recognized key is an error', () => {
  // Reporting ok here would let the Worker mark the lead written and drop it.
  assert.match(selectBatch_({ token: 'x' }).error, /no leads, messages or message/);
  assert.match(selectBatch_({}).error, /no leads/);
  assert.match(selectBatch_(null).error, /not an object/);
});

test('a non-array leads value does not pass as a batch', () => {
  assert.match(selectBatch_({ leads: 'nope' }).error, /no leads/);
});

test('locates the dedupe column by name, whatever its position', () => {
  assert.equal(findIdColumn_(HEADERS), 2);
  assert.equal(findIdColumn_(['wa_message_id']), 1);
  assert.equal(findIdColumn_(['a', 'b', 'wa_message_id']), 3);
});

test('reports 0 when the sheet has no dedupe column', () => {
  assert.equal(findIdColumn_(['a', 'b']), 0);
  assert.equal(findIdColumn_(undefined), 0);
});

test('drops leads already in the sheet', () => {
  const leads = [
    { wa_message_id: 'wamid.A' },
    { wa_message_id: 'wamid.B' },
    { wa_message_id: 'wamid.C' },
  ];
  const fresh = filterFresh_(leads, { 'wamid.B': true });

  assert.deepEqual(fresh.map((l) => l.wa_message_id), ['wamid.A', 'wamid.C']);
});

test('a retry of an entire batch appends nothing', () => {
  const leads = [{ wa_message_id: 'wamid.A' }, { wa_message_id: 'wamid.B' }];
  const seen = { 'wamid.A': true, 'wamid.B': true };

  assert.deepEqual(filterFresh_(leads, seen), []);
});

test('lets a lead with no id through rather than lose it', () => {
  assert.equal(filterFresh_([{ text: 'hi' }], {}).length, 1);
});

test('lays out a row in the sheet column order', () => {
  const [row] = mapRows_(
    [{ wa_message_id: 'wamid.A', text: 'שלום', from: '972500000000' }],
    HEADERS,
  );

  assert.equal(row.length, HEADERS.length);
  assert.equal(row[HEADERS.indexOf('wa_message_id')], 'wamid.A');
  assert.equal(row[HEADERS.indexOf('text')], 'שלום');
  assert.equal(row[HEADERS.indexOf('from')], '972500000000');
});

test('leaves the agent-owned columns blank', () => {
  const [row] = mapRows_([{ wa_message_id: 'wamid.A' }], HEADERS);

  assert.equal(row[HEADERS.indexOf('status')], '');
  assert.equal(row[HEADERS.indexOf('notes')], '');
});

test('follows a reordered sheet', () => {
  const reordered = ['text', 'wa_message_id'];
  const [row] = mapRows_([{ wa_message_id: 'wamid.A', text: 'hi' }], reordered);

  assert.deepEqual(row, ['hi', 'wamid.A']);
});

test('builds an id lookup and ignores blank rows', () => {
  const seen = idLookup_([['wamid.A'], [''], ['wamid.B'], [null]]);

  assert.deepEqual(seen, { 'wamid.A': true, 'wamid.B': true });
});
