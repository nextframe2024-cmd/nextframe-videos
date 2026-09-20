#!/usr/bin/env bash
# Sets the receiver's secrets and deploys it.
#
# Run from worker/. Each `wrangler secret put` prompts for the value and reads
# it without echoing, so no secret is passed as an argument or lands in shell
# history.
set -euo pipefail

cd "$(dirname "$0")"

command -v wrangler >/dev/null || {
  echo "wrangler not found: npm install -g wrangler" >&2
  exit 1
}

echo "VERIFY_TOKEN — any string. Paste the same one into Meta's webhook form."
echo "  Generate one with: openssl rand -hex 32"
wrangler secret put VERIFY_TOKEN

echo
echo "APP_SECRET — App Dashboard > App settings > Basic > App Secret."
wrangler secret put APP_SECRET

echo
echo "SHEETS_WEBAPP_URL — the Apps Script web app /exec URL."
wrangler secret put SHEETS_WEBAPP_URL

echo
echo "SHEETS_TOKEN — the TOKEN constant inside Code.gs."
wrangler secret put SHEETS_TOKEN

echo
wrangler deploy

echo
echo "Done. Give the printed URL to Meta as the Callback URL, with the same"
echo "VERIFY_TOKEN, and subscribe to the 'messages' field."
