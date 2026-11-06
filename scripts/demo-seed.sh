#!/usr/bin/env bash
# Seeds the demo account with real projects and real deployments through the REST API, so the
# dashboard has live data to show. Idempotent: existing projects (matched by slug) are reused, and a
# project is only deployed if it has never been deployed (pass --redeploy to deploy them all again).
#
#   hello-node        demo/hello-node,   port 8080, /health          → goes LIVE
#   hello-spring      demo/hello-spring, port 8080, /actuator/health → goes LIVE
#
# With --with-failure it also produces a real failed deploy for the agent to diagnose: it runs
# scripts/demo-push.sh break-port (hello-node starts listening on 3000 instead of PORT, the health
# check fails, the agent reports PORT_MISMATCH while v1 keeps serving), waits for that deploy to
# finish, then demo-push.sh fix (a good deploy goes live again). No sample repo listens on a wrong
# port by itself (both honour PORT), so the failure comes from that real pushed commit.
#
# Prerequisites: scripts/demo-repos.sh has been run, FORGE_GIT_BASE_URL in .env points at it, and
# forge-server is running locally. Needs curl and jq.
# Usage: scripts/demo-seed.sh [--redeploy] [--with-failure]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${FORGE_API:-http://localhost:8080}"
REDEPLOY=""; FAILURE=""
for arg in "$@"; do
  case "$arg" in
    --redeploy) REDEPLOY="--redeploy" ;;
    --with-failure) FAILURE=1 ;;
    *) echo "unknown option $arg" >&2; exit 1 ;;
  esac
done

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

wait_idle() { # slug: waits until the project's newest deployment is no longer in progress
  local id status
  id="$(api GET "/projects?size=100" | jq -r --arg s "$1" '.content[] | select(.slug == $s) | .id')"
  for _ in $(seq 1 120); do
    status="$(api GET "/projects/$id/deployments?size=1" | jq -r '.content[0].status // "NONE"')"
    case "$status" in QUEUED|BUILDING|DEPLOYING|HEALTH_CHECKING|CANARY) sleep 5 ;; *) echo "$1: $status"; return ;; esac
  done
  echo "timed out waiting for $1" >&2; exit 1
}

if [[ -n "$FAILURE" ]]; then
  wait_idle hello-node
  "$ROOT/scripts/demo-push.sh" break-port hello-node
  sleep 3; wait_idle hello-node   # expect FAILED (UNHEALTHY → agent: PORT_MISMATCH)
  "$ROOT/scripts/demo-push.sh" fix hello-node
fi

echo
echo "Deploys run in the background; watch them at http://localhost:3000."
