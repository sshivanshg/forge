#!/usr/bin/env bash
# Seeds the demo account with real projects and real deployments through the REST API, so the
# dashboard has live data to show. Idempotent: existing projects (matched by slug) are reused, and a
# project is only deployed if it has never been deployed (pass --redeploy to deploy them all again).
#
#   hello-node        demo/hello-node,   port 8080, /health          → goes LIVE
#   hello-spring      demo/hello-spring, port 8080, /actuator/health → goes LIVE
#   spring-wrong-port demo/hello-spring, port 3000, /actuator/health → FAILS: Forge sets PORT=3000,
#                     but Spring Boot ignores PORT and listens on 8080, so the health check fails
#                     and the agent diagnoses PORT_MISMATCH
#
# Prerequisites: scripts/demo-repos.sh has been run, FORGE_GIT_BASE_URL in .env points at it, and
# forge-server is running locally. Needs curl and jq.
# Usage: scripts/demo-seed.sh [--redeploy]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${FORGE_API:-http://localhost:8080}"
REDEPLOY="${1:-}"

case "$API" in
  http://localhost:*|http://127.0.0.1:*|http://localhost|http://127.0.0.1) ;;
  *) echo "refusing to seed $API: demo-seed.sh only runs against localhost" >&2; exit 1 ;;
esac
command -v jq >/dev/null || { echo "jq is required (brew install jq)" >&2; exit 1; }

env_value() { grep "^$1=" "$ROOT/.env" | cut -d= -f2- || true; }
EMAIL="${FORGE_DEMO_EMAIL:-$(env_value FORGE_DEMO_EMAIL)}"
PASSWORD="${FORGE_DEMO_PASSWORD:-$(env_value FORGE_DEMO_PASSWORD)}"
[[ -n "$EMAIL" && -n "$PASSWORD" ]] || {
  echo "FORGE_DEMO_EMAIL / FORGE_DEMO_PASSWORD are not set in .env" >&2; exit 1; }

login="$(jq -n --arg e "$EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}')"
TOKEN="$(curl -sSf -X POST "$API/api/v1/auth/login" -H "Content-Type: application/json" \
  --data "$login" | jq -r .accessToken)" || {
  echo "login failed for $EMAIL (is forge-server running with the demo account configured?)" >&2; exit 1; }

api() { # method path [json]
  curl -sSf -X "$1" "$API/api/v1$2" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" ${3:+--data "$3"}
}

existing="$(api GET "/projects?size=100" | jq -c '.content // .items // .')"

seed() { # name slug repo port healthPath
  local name="$1" slug="$2" repo="$3" port="$4" health="$5" id body
  id="$(jq -r --arg s "$slug" '.[] | select(.slug == $s) | .id' <<<"$existing")"
  if [[ -z "$id" ]]; then
    body="$(jq -n --arg n "$name" --arg s "$slug" --arg r "$repo" --argjson p "$port" --arg h "$health" \
      '{name:$n, slug:$s, repoOwner:"demo", repoName:$r, port:$p, healthCheckPath:$h}')"
    id="$(api POST /projects "$body" | jq -r .id)"
    echo "created  $slug ($id)"
  else
    echo "exists   $slug ($id)"
  fi
  local deployed
  deployed="$(api GET "/projects/$id/deployments?size=1" | jq '(.content // .items // []) | length')"
  if [[ "$deployed" == "0" || "$REDEPLOY" == "--redeploy" ]]; then
    local dep
    dep="$(api POST "/projects/$id/deployments" | jq -r .id)"
    echo "deploying $slug → deployment $dep"
  else
    echo "skipped  $slug (already deployed; use --redeploy)"
  fi
}

seed "Hello Node" hello-node hello-node 8080 /health
seed "Hello Spring" hello-spring hello-spring 8080 /actuator/health
seed "Spring Wrong Port" spring-wrong-port hello-spring 3000 /actuator/health

echo
echo "Deploys run in the background; watch them at http://localhost:3000."
