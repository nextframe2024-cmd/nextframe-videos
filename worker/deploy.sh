#!/usr/bin/env bash
# Sets the receiver's secrets and deploys it.
#
# Run from anywhere. Each `wrangler secret put` prompts for the value and reads
# it without echoing, so no secret is passed as an argument or lands in shell
# history.
set -euo pipefail

cd "$(dirname "$0")"

command -v wrangler >/dev/null || {
  echo "wrangler not found: npm install -g wrangler" >&2
  exit 1
}

# A broken receiver that answers Meta's handshake is worse than one that never
# deployed, so the tests gate the deploy.
echo "Running tests..."
npm test --silent >/dev/null || {
  echo "tests failed — not deploying. Run 'npm test' to see why." >&2
  exit 1
}
echo "Tests pass."
echo

if grep -q '^\[\[kv_namespaces\]\]' wrangler.toml; then
  echo "KV dedupe: configured."
else
  echo "KV dedupe is not configured. Without it a Meta retry can write a lead"
  echo "twice before the sheet's own dedupe catches it."
  read -r -p "Create the SEEN namespace now? [y/N] " answer
  if [[ ${answer:-} =~ ^[Yy]$ ]]; then
    # The id is the only thing needed from the output; formats have varied, so
    # take the first quoted 32-hex string.
    created=$(wrangler kv namespace create SEEN)
    echo "$created"
    id=$(printf '%s' "$created" | grep -oE '[0-9a-f]{32}' | head -1)
    if [[ -n $id ]]; then
      cat >>wrangler.toml <<TOML

[[kv_namespaces]]
binding = "SEEN"
id = "$id"
TOML
      echo "Wrote the binding to wrangler.toml."
    else
      echo "Could not read the id from that output — add the binding to" >&2
      echo "wrangler.toml by hand before deploying." >&2
    fi
  fi
fi
echo

# Deploy before the secrets. The upload is the first and only check against
# the Workers runtime — neither the test suite nor `--dry-run` catches what it
# rejects — and a deployed Worker with no secrets is harmless: without
# APP_SECRET every delivery is refused, and Meta is not pointed at it yet.
echo "Deploying (validates the script against the Workers runtime)..."
wrangler deploy
echo

# Existing secrets are left alone, so a redeploy does not mean retyping them.
existing=$(wrangler secret list 2>/dev/null || echo '[]')

put_secret() {
  local name=$1 hint=$2
  if printf '%s' "$existing" | grep -q "\"$name\""; then
    echo "$name: already set, skipping."
    return
  fi
  echo "$name — $hint"
  wrangler secret put "$name"
  echo
}

put_secret VERIFY_TOKEN \
  "any string; paste the same one into Meta's form. Generate: openssl rand -hex 32"
put_secret APP_SECRET \
  "App Dashboard > App settings > Basic > App Secret."
put_secret SHEETS_WEBAPP_URL \
  "the Apps Script web app /exec URL."
put_secret SHEETS_TOKEN \
  "the TOKEN constant inside Code.gs."

echo
echo "Give the printed URL to Meta as the Callback URL, with the same"
echo "VERIFY_TOKEN, then subscribe to the 'messages' field."
