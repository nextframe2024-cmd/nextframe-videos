import { parseLeads } from './parse.js';
import { verifySignature } from './signature.js';
import { selectSink } from './sinks.js';

/**
 * Receives WhatsApp Cloud API webhooks and forwards inbound messages to a sink.
 *
 * GET  — Meta's subscription handshake.
 * POST — signed event delivery.
 */

/**
 * A fresh 200 per call. Meta retries any non-2xx, so a sink failure has to
 * surface as 500 and everything else as this.
 *
 * Deliberately a function, not a module-scope constant: the Workers runtime
 * refuses a Response built in global scope, and a single instance could not
 * be returned twice anyway, since a body can only be read once.
 */
const ok = () => new Response('ok', { status: 200 });

function handleVerification(url, env) {
  const params = url.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && env.VERIFY_TOKEN && token === env.VERIFY_TOKEN) {
    return new Response(challenge ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return new Response('forbidden', { status: 403 });
}

/**
 * Drops leads already written, so Meta's retries cannot duplicate rows.
 * Without a KV binding there is no dedupe and every lead passes through.
 */
async function filterSeen(leads, env) {
  if (!env.SEEN) return leads;

  const checks = await Promise.all(
    leads.map((lead) => env.SEEN.get(lead.wa_message_id)),
  );
  return leads.filter((_, i) => checks[i] === null);
}

/** Marked only after a successful write, so a failed retry is not swallowed. */
async function markSeen(leads, env) {
  if (!env.SEEN) return;

  // A wamid is only replayed for a short window; a week is ample.
  const expirationTtl = 60 * 60 * 24 * 7;
  await Promise.all(
    leads.map((lead) => env.SEEN.put(lead.wa_message_id, '1', { expirationTtl })),
  );
}

async function handleEvent(request, env) {
  const rawBody = await request.text();

  const valid = await verifySignature(
    rawBody,
    request.headers.get('X-Hub-Signature-256'),
    env.APP_SECRET,
  );
  if (!valid) return new Response('bad signature', { status: 401 });

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Malformed JSON will never parse on retry, so accept and drop it.
    console.warn('unparseable body');
    return ok();
  }

  const leads = parseLeads(payload);
  if (leads.length === 0) return ok(); // Status updates and other noise.

  const fresh = await filterSeen(leads, env);
  if (fresh.length === 0) return ok();

  try {
    await selectSink(env).write(fresh);
  } catch (error) {
    console.error('sink write failed', error.message);
    return new Response('sink failed', { status: 500 });
  }

  await markSeen(fresh, env);
  return ok();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET') return handleVerification(url, env);
    if (request.method === 'POST') return handleEvent(request, env);

    return new Response('method not allowed', { status: 405 });
  },
};
