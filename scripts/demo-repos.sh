#!/usr/bin/env bash
# Creates local Git repositories for the sample apps so Forge can be demoed without GitHub.
# Start the server with FORGE_GIT_BASE_URL=file://$HOME/.forge/demo-repos and create projects
# with repo owner "demo" and repo name "hello-node" or "hello-spring".
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPOS="${FORGE_DEMO_REPOS:-$HOME/.forge/demo-repos}"

for app in hello-node hello-spring; do
  bare="$REPOS/demo/$app.git"
  rm -rf "$bare"
  mkdir -p "$bare"
  git init -q --bare -b main "$bare"
  work="$(mktemp -d)"
  cp -R "$ROOT/sample-apps/$app/." "$work/"
  git -C "$work" init -q -b main
  git -C "$work" add .
  git -C "$work" -c user.name="Forge Demo" -c user.email="demo@forge.local" commit -q -m "feat: initial version of $app"
  git -C "$work" remote add origin "$bare"
  git -C "$work" push -q origin main
  rm -rf "$work"
  echo "created $bare"
done

echo
echo "Add this to .env, then restart forge-server:"
echo "FORGE_GIT_BASE_URL=file://$REPOS"
