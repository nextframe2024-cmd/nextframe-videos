/**
 * Posts correctly signed deliveries straight at the deployed Worker, so a
 * failure can be located without Meta in the loop.
 *
 * Meta's "Successfully tested" only reports that it sent the request — it does
 * not say what came back. This does.
 *
 *   set APP_SECRET=...                       (cmd)
 *   set VERIFY_TOKEN=...                     (optional)
 *   node probe.mjs https://<worker>.workers.dev
 *
 * Secrets come from the environment rather than argv so they stay out of the
 * command history.
 */

import { createHmac, randomUUID } from 'node:crypto';

const url = process.argv[2];
const APP_SECRET = process.env.APP_SECRET;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

if (!url) {
  console.error('usage: node probe.mjs <worker-url>   (APP_SECRET in the env)');
  process.exit(1);
}
if (!APP_SECRET) {
  console.error('APP_SECRET is not set in the environment.');
  process.exit(1);
}

const sign = (body) =>
  `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`;

/** A unique id each run, so the dedupe layers cannot mask a working write. */
const id = () => `wamid.PROBE.${randomUUID()}`;

const value = (messageId) => ({
  metadata: { phone_number_id: '715040758363218' },
  contacts: [{ wa_id: '972000000000', profile: { name: 'probe' } }],
  messages: [
    {
      from: '972000000000',
      id: messageId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'text',
      text: { body: 'probe from probe.mjs' },
    },
  ],
});

async function show(label, request, expected) {
  let line;
  try {
    const response = await request();
    const body = (await response.text()).slice(0, 300);
    const verdict = response.status === expected ? 'ok' : 'UNEXPECTED';
    line = `${String(response.status).padEnd(4)} ${verdict.padEnd(11)} ${body}`;
  } catch (error) {
    line = `---  FAILED      ${error.message}`;
  }
  console.log(`${label.padEnd(26)} want ${expected}  got ${line}`);
}

const post = (payload, { signed = true } = {}) => {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  if (signed) headers['X-Hub-Signature-256'] = sign(body);
  return () => fetch(url, { method: 'POST', headers, body });
};

console.log(`\nprobing ${url}\n`);

if (VERIFY_TOKEN) {
  const params = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': VERIFY_TOKEN,
    'hub.challenge': '12345',
  });
  await show('GET handshake', () => fetch(`${url}?${params}`), 200);
}
await show('GET wrong verify token', () =>
  fetch(`${url}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`), 403);

await show('POST unsigned', post({ field: 'messages', value: value(id()) }, { signed: false }), 401);

await show(
  'POST signed, dashboard',
  post({ field: 'messages', value: value(id()) }),
  200,
);

await show(
  'POST signed, cloud api',
  post({
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA', changes: [{ field: 'messages', value: value(id()) }] }],
  }),
  200,
);

await show(
  'POST signed, status only',
  post({ field: 'messages', value: { metadata: {}, statuses: [{ id: 'x', status: 'read' }] } }),
  200,
);

console.log(`
How to read this:

  GET handshake 403          VERIFY_TOKEN here does not match the Worker's.
  POST unsigned 200          the signature check is not running. Stop.
  POST signed 401            APP_SECRET here does not match the Worker's.
                             One of the two is wrong — check App settings >
                             Basic against 'wrangler secret list'.
  POST signed 500            the Worker is fine; the sink refused. Run
                             'wrangler tail' to see which error, usually a
                             wrong SHEETS_TOKEN or SHEETS_WEBAPP_URL.
  POST signed 200            the Worker accepted and the sink wrote. A row
                             should be in the sheet — two of them, from the
                             dashboard and cloud api shapes.
`);
