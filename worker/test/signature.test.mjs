import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature } from '../src/signature.js';

const SECRET = 'app-secret-value';
const BODY = '{"object":"whatsapp_business_account"}';

const sign = (body, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

test('accepts a signature over the exact body', async () => {
  assert.equal(await verifySignature(BODY, sign(BODY), SECRET), true);
});

test('rejects a signature made with another secret', async () => {
  assert.equal(await verifySignature(BODY, sign(BODY, 'wrong'), SECRET), false);
});

test('rejects a body that changed after signing', async () => {
  const header = sign(BODY);
  assert.equal(await verifySignature(BODY + ' ', header, SECRET), false);
});

test('fails closed when no app secret is configured', async () => {
  assert.equal(await verifySignature(BODY, sign(BODY), undefined), false);
});

test('rejects malformed or missing headers', async () => {
  assert.equal(await verifySignature(BODY, null, SECRET), false);
  assert.equal(await verifySignature(BODY, 'sha1=abcd', SECRET), false);
  assert.equal(await verifySignature(BODY, 'sha256=nothex', SECRET), false);
  assert.equal(await verifySignature(BODY, 'sha256=abc', SECRET), false);
});
