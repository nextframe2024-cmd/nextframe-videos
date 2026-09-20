import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectSink } from '../src/sinks.js';

const ENV = { SHEETS_WEBAPP_URL: 'https://script.google.com/x/exec', SHEETS_TOKEN: 'tok' };
const LEAD = { wa_message_id: 'wamid.AAA', text: 'hi' };

/** Replaces global fetch for one call and captures what was sent. */
function stubFetch(response) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return response;
  };
  return calls;
}

const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

test('posts the token and the leads batch', async () => {
  const calls = stubFetch(reply(200, '{"ok":true,"appended":1}'));

  await selectSink(ENV).write([LEAD]);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENV.SHEETS_WEBAPP_URL);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.token, 'tok');
  assert.deepEqual(sent.leads, [LEAD]);
});

test('throws when the script refuses the request', async () => {
  // Apps Script answers 200 even on refusal, so only the body reveals this.
  stubFetch(reply(200, '{"ok":false,"error":"unauthorized"}'));

  await assert.rejects(() => selectSink(ENV).write([LEAD]), /unauthorized/);
});

test('throws when the script reports a contract mismatch', async () => {
  stubFetch(reply(200, '{"ok":false,"error":"no leads, messages or message in payload"}'));

  await assert.rejects(() => selectSink(ENV).write([LEAD]), /no leads/);
});

test('throws on an HTML error page instead of JSON', async () => {
  // A misconfigured deployment serves Google's sign-in page, not JSON.
  stubFetch(reply(200, '<!DOCTYPE html><title>Sign in</title>'));

  await assert.rejects(() => selectSink(ENV).write([LEAD]), /non-JSON/);
});

test('throws on an HTTP error', async () => {
  stubFetch(reply(500, 'boom'));

  await assert.rejects(() => selectSink(ENV).write([LEAD]), /HTTP 500/);
});

test('falls back to the log sink with no webapp url', async () => {
  // Must not attempt a request at all.
  stubFetch(reply(500, 'should not be called'));

  await selectSink({}).write([LEAD]);
});
