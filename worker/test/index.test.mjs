import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker from '../src/index.js';

const APP_SECRET = 'app-secret';
const VERIFY_TOKEN = 'vt';

/** No SHEETS_WEBAPP_URL, so the log sink is used and nothing is fetched. */
const ENV = { APP_SECRET, VERIFY_TOKEN };

const sign = (body) =>
  `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`;

const signedPost = (payload) => {
  const body = JSON.stringify(payload);
  return new Request('https://receiver.example/', {
    method: 'POST',
    headers: { 'X-Hub-Signature-256': sign(body), 'Content-Type': 'application/json' },
    body,
  });
};

const message = (id) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA',
      changes: [
        {
          field: 'messages',
          value: {
            metadata: { phone_number_id: '715040758363218' },
            messages: [
              { from: '972500000000', id, timestamp: '1758000000', type: 'text', text: { body: 'hi' } },
            ],
          },
        },
      ],
    },
  ],
});

const statusOnly = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA',
      changes: [
        { field: 'messages', value: { metadata: {}, statuses: [{ id: 'x', status: 'delivered' }] } },
      ],
    },
  ],
};

test('answers the verification handshake with the challenge', async () => {
  const url = `https://receiver.example/?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`;
  const response = await worker.fetch(new Request(url), ENV);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '12345');
});

test('refuses the handshake with a wrong token', async () => {
  const url = 'https://receiver.example/?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=12345';
  const response = await worker.fetch(new Request(url), ENV);

  assert.equal(response.status, 403);
});

test('rejects an unsigned delivery', async () => {
  const request = new Request('https://receiver.example/', {
    method: 'POST',
    body: JSON.stringify(message('wamid.A')),
  });
  const response = await worker.fetch(request, ENV);

  assert.equal(response.status, 401);
});

test('accepts a signed delivery', async () => {
  const response = await worker.fetch(signedPost(message('wamid.A')), ENV);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'ok');
});

test('accepts a status-only delivery without reaching the sink', async () => {
  const response = await worker.fetch(signedPost(statusOnly), ENV);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'ok');
});

test('each reply is a fresh Response', async () => {
  // A module-scope Response is both refused by the Workers runtime and
  // unusable twice, since a body can only be read once.
  const first = await worker.fetch(signedPost(message('wamid.A')), ENV);
  const second = await worker.fetch(signedPost(message('wamid.B')), ENV);

  assert.notEqual(first, second);
  assert.equal(await first.text(), 'ok');
  assert.equal(await second.text(), 'ok');
});

test('reports 500 when the sink refuses, so Meta retries', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => '{"ok":false,"error":"unauthorized"}',
  });

  const response = await worker.fetch(signedPost(message('wamid.C')), {
    ...ENV,
    SHEETS_WEBAPP_URL: 'https://script.google.com/x/exec',
    SHEETS_TOKEN: 'tok',
  });

  assert.equal(response.status, 500);
});

test('rejects a method that is neither GET nor POST', async () => {
  const response = await worker.fetch(
    new Request('https://receiver.example/', { method: 'DELETE' }),
    ENV,
  );

  assert.equal(response.status, 405);
});

test('a dashboard test delivery reaches the sink', async () => {
  // The end-to-end shape of the failure: Meta reported the test webhook as
  // successful while nothing was ever written.
  const sent = [];
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => '{"ok":true,"appended":1}' };
  };

  const dashboardShape = {
    field: 'messages',
    value: {
      metadata: { phone_number_id: '715040758363218' },
      messages: [
        { from: '972500000000', id: 'wamid.DASH', timestamp: '1758000200', type: 'text', text: { body: 'probe' } },
      ],
    },
  };

  const response = await worker.fetch(signedPost(dashboardShape), {
    ...ENV,
    SHEETS_WEBAPP_URL: 'https://script.google.com/x/exec',
    SHEETS_TOKEN: 'tok',
  });

  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].leads.length, 1);
  assert.equal(sent[0].leads[0].wa_message_id, 'wamid.DASH');
  assert.equal(sent[0].leads[0].text, 'probe');
});
