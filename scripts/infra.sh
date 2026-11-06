#!/usr/bin/env bash
# Local infrastructure for Forge on Apple container (macOS 26+, Apple silicon).
#
#   scripts/infra.sh up      start Traefik (routing) and Mailpit (emails)
#   scripts/infra.sh down    stop and remove them
#   scripts/infra.sh status  show what is running
#
# Postgres is not started here: Forge uses a local PostgreSQL 16 (brew services start
# postgresql@16) with a "forge" role and database; see the README.
#
# User apps run in their own Apple container VMs and are reached on their own IPs. Traefik
# polls Forge's routing table (/internal/routing) every second instead of reading Docker labels.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TRAEFIK_IMAGE="traefik:v3.6"
MAILPIT_IMAGE="axllent/mailpit:latest"

token() {
  local t
  t="$(grep '^FORGE_ROUTING_TOKEN=' "$ROOT/.env" 2>/dev/null | cut -d= -f2-)"
  if [ -z "$t" ]; then
    t="$(openssl rand -hex 24)"
    echo "FORGE_ROUTING_TOKEN=$t" >> "$ROOT/.env"
    echo "added FORGE_ROUTING_TOKEN to .env (restart forge-server to pick it up)" >&2
  fi
  echo "$t"
}

# The Mac as seen from inside a container: the gateway of the default container network.
host_ip() {
  container network inspect default 2>/dev/null \
    | python3 -c 'import sys,json; d=json.load(sys.stdin); d=d[0] if isinstance(d,list) else d; print(d["status"]["ipv4Gateway"])' 2>/dev/null \
    || echo "192.168.64.1"
}

up() {
  container system start >/dev/null
  down >/dev/null 2>&1 || true
  local gateway; gateway="$(host_ip)"
  container run --detach --name forge-traefik \
    --publish 80:80 --publish 127.0.0.1:8090:8080 --publish 127.0.0.1:8082:8082 \
    --memory 256M --cpus 1 \
    "$TRAEFIK_IMAGE" \
    --entrypoints.web.address=:80 \
    --entrypoints.metrics.address=:8082 \
    --metrics.prometheus=true --metrics.prometheus.entryPoint=metrics \
    --metrics.prometheus.addServicesLabels=true \
    --providers.http.endpoint="http://$gateway:8080/internal/routing" \
    --providers.http.pollInterval=1s \
    --providers.http.headers.X-Forge-Routing-Token="$(token)" \
    --serversTransport.forwardingTimeouts.dialTimeout=1s \
    --api.dashboard=true --api.insecure=true \
    --log.level=INFO >/dev/null
  container run --detach --name forge-mailpit \
    --publish 127.0.0.1:1025:1025 --publish 127.0.0.1:8025:8025 \
    --memory 256M --cpus 1 \
    "$MAILPIT_IMAGE" >/dev/null
  echo "Traefik:  http://<project-slug>.localhost  (dashboard http://localhost:8090)"
  echo "Metrics:  http://localhost:8082/metrics  (read by canary rollouts)"
  echo "Mailpit:  http://localhost:8025"
  echo "Routing:  Traefik polls http://$gateway:8080/internal/routing"
}

down() {
  container delete --force forge-traefik forge-mailpit 2>/dev/null || true
}

status() {
  container list --all
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  status) status ;;
  *) echo "usage: $0 up|down|status"; exit 1 ;;
esac
