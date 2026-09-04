#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
STAGE="$DIST/weekly-review-capture"
VERSION="$(node -p "require('$ROOT/manifest.json').version")"

node "$ROOT/scripts/generate-icons.mjs"
rm -rf "$DIST"
mkdir -p "$STAGE"

cp "$ROOT/manifest.json" "$STAGE/"
cp -R "$ROOT/src" "$STAGE/"
cp -R "$ROOT/icons" "$STAGE/"
cp -R "$ROOT/_locales" "$STAGE/"
rm -f "$STAGE/icons/icon.svg"
node "$ROOT/scripts/prepare-store-manifest.mjs" "$STAGE/manifest.json"

(
  cd "$STAGE"
  zip -qr "$DIST/weekly-review-capture-$VERSION.zip" .
)

echo "Created: $DIST/weekly-review-capture-$VERSION.zip"
