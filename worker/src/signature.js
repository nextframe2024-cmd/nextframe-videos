/**
 * Verifies Meta's X-Hub-Signature-256 header over the raw request body.
 *
 * Meta signs the exact bytes it sent, so the caller must pass the raw body
 * text — re-serializing parsed JSON changes the bytes and breaks the check.
 */

const encoder = new TextEncoder();

/** Constant-time byte comparison, to avoid leaking the digest via timing. */
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i] = byte;
  }
  return out;
}

export async function verifySignature(rawBody, header, appSecret) {
  if (!appSecret) return false;
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;

  const provided = hexToBytes(header.slice('sha256='.length).trim());
  if (!provided) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody)),
  );

  return equalBytes(provided, expected);
}
