import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLeads } from '../src/parse.js';

const wrap = (value) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'WABA', changes: [{ field: 'messages', value }] }],
});

const metadata = { phone_number_id: '106540352242922' };

test('extracts a text message as a lead', () => {
  const [lead] = parseLeads(
    wrap({
      metadata,
      contacts: [{ wa_id: '972500000000', profile: { name: 'Dana' } }],
      messages: [
        {
          from: '972500000000',
          id: 'wamid.AAA',
          timestamp: '1758000000',
          type: 'text',
          text: { body: 'מחפשת הצעת מחיר' },
        },
      ],
    }),
  );

  assert.equal(lead.wa_message_id, 'wamid.AAA');
  assert.equal(lead.from, '972500000000');
  assert.equal(lead.name, 'Dana');
  assert.equal(lead.type, 'text');
  assert.equal(lead.text, 'מחפשת הצעת מחיר');
  assert.equal(lead.phone_number_id, '106540352242922');
  assert.equal(lead.received_at, new Date(1758000000 * 1000).toISOString());
});

test('drops delivery-status events', () => {
  const payload = wrap({
    metadata,
    statuses: [{ id: 'wamid.BBB', status: 'delivered', timestamp: '1758000001' }],
  });
  assert.deepEqual(parseLeads(payload), []);
});

test('keeps the caption and media id of an image', () => {
  const [lead] = parseLeads(
    wrap({
      metadata,
      messages: [
        {
          from: '972500000001',
          id: 'wamid.CCC',
          timestamp: '1758000002',
          type: 'image',
          image: { id: 'media-123', caption: 'זה המוצר' },
        },
      ],
    }),
  );

  assert.equal(lead.media_id, 'media-123');
  assert.equal(lead.text, 'זה המוצר');
});

test('flattens a location to lat,lng', () => {
  const [lead] = parseLeads(
    wrap({
      metadata,
      messages: [
        {
          from: '972500000002',
          id: 'wamid.DDD',
          timestamp: '1758000003',
          type: 'location',
          location: { latitude: 32.0853, longitude: 34.7818 },
        },
      ],
    }),
  );

  assert.equal(lead.location, '32.0853,34.7818');
});

test('reads the title of an interactive reply', () => {
  const [lead] = parseLeads(
    wrap({
      metadata,
      messages: [
        {
          from: '972500000003',
          id: 'wamid.EEE',
          timestamp: '1758000004',
          type: 'interactive',
          interactive: { button_reply: { id: 'b1', title: 'כן, מעניין' } },
        },
      ],
    }),
  );

  assert.equal(lead.text, 'כן, מעניין');
});

test('handles several messages in one delivery', () => {
  const leads = parseLeads(
    wrap({
      metadata,
      messages: [
        { from: '1', id: 'wamid.1', timestamp: '1758000005', type: 'text', text: { body: 'a' } },
        { from: '2', id: 'wamid.2', timestamp: '1758000006', type: 'text', text: { body: 'b' } },
      ],
    }),
  );

  assert.equal(leads.length, 2);
  assert.deepEqual(leads.map((l) => l.text), ['a', 'b']);
});

test('ignores payloads from another product', () => {
  assert.deepEqual(parseLeads({ object: 'page', entry: [] }), []);
  assert.deepEqual(parseLeads(null), []);
});

test('survives a message type it does not know', () => {
  const [lead] = parseLeads(
    wrap({
      metadata,
      messages: [{ from: '3', id: 'wamid.FFF', timestamp: '1758000007', type: 'order' }],
    }),
  );

  assert.equal(lead.type, 'order');
  assert.equal(lead.text, '');
  assert.equal(lead.media_id, '');
});

// --- envelope shapes -------------------------------------------------------

test('reads the bare shape the App Dashboard test button sends', () => {
  // No object, no entry, no changes. A parser expecting only the wrapped form
  // found nothing, answered 200, and Meta reported the test as successful.
  const [lead] = parseLeads({
    field: 'messages',
    value: {
      metadata,
      contacts: [{ wa_id: '972500000000', profile: { name: 'Test' } }],
      messages: [
        {
          from: '972500000000',
          id: 'wamid.DASHBOARD',
          timestamp: '1758000100',
          type: 'text',
          text: { body: 'dashboard probe' },
        },
      ],
    },
  });

  assert.equal(lead.wa_message_id, 'wamid.DASHBOARD');
  assert.equal(lead.name, 'Test');
  assert.equal(lead.text, 'dashboard probe');
  assert.equal(lead.phone_number_id, '106540352242922');
});

test('drops a bare status-only delivery', () => {
  const payload = {
    field: 'messages',
    value: { metadata, statuses: [{ id: 'wamid.X', status: 'read' }] },
  };
  assert.deepEqual(parseLeads(payload), []);
});

test('reads an entry envelope with no object key', () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            field: 'messages',
            value: {
              metadata,
              messages: [
                { from: '1', id: 'wamid.NOOBJ', timestamp: '1758000101', type: 'text', text: { body: 'x' } },
              ],
            },
          },
        ],
      },
    ],
  };

  assert.equal(parseLeads(payload)[0].wa_message_id, 'wamid.NOOBJ');
});

test('still refuses a bare payload from another product', () => {
  const payload = {
    object: 'instagram',
    field: 'messages',
    value: { metadata, messages: [{ from: '1', id: 'wamid.IG', timestamp: '1', type: 'text' }] },
  };
  assert.deepEqual(parseLeads(payload), []);
});
