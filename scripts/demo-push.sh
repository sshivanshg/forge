#!/usr/bin/env bash
# Pushes a demo change to a local sample-app repository and sends Forge a signed "push" webhook,
# exactly like GitHub would. Scenarios:
#   v2          – visible change ("v2"), deploys with zero downtime
#   break-port  – app ignores PORT and listens on 3000 → health check fails → agent: PORT_MISMATCH
#   crash       – app throws at startup → agent: CRASH_ON_STARTUP / MISSING_CONFIGURATION
#   fix         – restores the original app
# Usage: scripts/demo-push.sh <scenario> [app]
set -euo pipefail

SCENARIO="${1:?scenario: v2 | break-port | crash | fix}"
APP="${2:-hello-node}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPOS="${FORGE_DEMO_REPOS:-$HOME/.forge/demo-repos}"
API="${FORGE_API:-http://localhost:8080}"

work="$(mktemp -d)"
git clone -q "$REPOS/demo/$APP.git" "$work"
cp -R "$ROOT/sample-apps/$APP/." "$work/"   # start from the clean app every time

case "$SCENARIO" in
  v2)         sed -i '' 's/const version = "v1"/const version = "v2"/' "$work/server.js"; msg="feat: release v2" ;;
  break-port) sed -i '' 's/Number(process.env.PORT || 8080)/3000/' "$work/server.js"; msg="refactor: simplify port config" ;;
  crash)      printf 'if (!process.env.DATABASE_URL) {\n  throw new Error("DATABASE_URL is not defined");\n}\n' | cat - "$work/server.js" > "$work/tmp.js" && mv "$work/tmp.js" "$work/server.js"; msg="feat: connect to the database" ;;
  fix)        msg="fix: restore working version" ;;
  *)          echo "unknown scenario $SCENARIO"; exit 1 ;;
esac

git -C "$work" add -A
git -C "$work" -c user.name="Forge Demo" -c user.email="demo@forge.local" commit -q --allow-empty -m "$msg"
git -C "$work" push -q origin main
sha="$(git -C "$work" rev-parse HEAD)"
rm -rf "$work"

secret="$(grep '^FORGE_GITHUB_WEBHOOK_SECRET=' "$ROOT/.env" | cut -d= -f2-)"
body="$(printf '{"ref":"refs/heads/main","after":"%s","deleted":false,"head_commit":{"message":"%s"},"repository":{"name":"%s","owner":{"login":"demo"}}}' "$sha" "$msg" "$APP")"
signature="$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$secret" | awk '{print $NF}')"

echo "pushed $sha ($msg); sending webhook…"
curl -sS -X POST "$API/api/v1/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: $(uuidgen)" \
  -H "X-Hub-Signature-256: sha256=$signature" \
  --data "$body"
echo
