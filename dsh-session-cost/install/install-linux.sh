#!/usr/bin/env bash
# Install dsh-session-cost into a DSH profile on Linux or macOS.
#
# Usage:
#   ./install/install-linux.sh [profile]
#
# The profile defaults to "web". Set DSH_HOME to use a non-default DSH home.
set -euo pipefail

PROFILE="${1:-web}"
PLUGIN_NAME="dsh-session-cost"
PLUGIN_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PATCH="$PROFILE_DIR/cordis.patch.yml"
DEST="$DSH_HOME/plugins/$PLUGIN_NAME"
MARK_BEGIN="# >>> dsh-session-cost (managed) >>>"
MARK_END="# <<< dsh-session-cost (managed) <<<"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || die "Node.js is required (DSH already needs it)."
[ -f "$PLUGIN_SRC/lib/client.js" ] || die "plugin files not found next to this script: $PLUGIN_SRC"
[ -f "$PLUGIN_SRC/lib/index.js" ] || die "missing $PLUGIN_SRC/lib/index.js"
[ -d "$PROFILE_DIR" ] || die "profile '$PROFILE' not found at $PROFILE_DIR
Start DSH once with that profile (for example: dsh web), then run this script again."

[ -f "$PATCH" ] || printf '[]\n' > "$PATCH"

STAMP="$(date +%Y%m%d-%H%M%S)"
cp "$PATCH" "$PATCH.bak.$STAMP"

mkdir -p "$DSH_HOME/plugins"
if [ -e "$DEST" ]; then
  INSTALLED_NAME="$(node -e 'try { process.stdout.write(require(process.argv[1]).name) } catch {}' "$DEST/package.json" 2>/dev/null || true)"
  [ "$INSTALLED_NAME" = "$PLUGIN_NAME" ] || die "refusing to replace $DEST: it is not $PLUGIN_NAME"
  rm -rf "$DEST"
fi
mkdir -p "$DEST"
cp -R "$PLUGIN_SRC/lib" "$DEST/"
cp "$PLUGIN_SRC/package.json" "$DEST/"
if [ -f "$PLUGIN_SRC/README.md" ]; then cp "$PLUGIN_SRC/README.md" "$DEST/"; fi

ENTRY="$(node -e 'console.log(require("node:url").pathToFileURL(process.argv[1]).href)' "$DEST/lib/index.js")"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Drop a previous managed block so the script is safe to re-run.
awk -v begin="$MARK_BEGIN" -v end="$MARK_END" '
  $0 == begin { skip = 1; next }
  $0 == end   { skip = 0; next }
  !skip       { print }
' "$PATCH" > "$TMP"

# An empty list must not stay next to the inserted block; keep any comments.
awk '!/^[[:space:]]*\[[[:space:]]*\][[:space:]]*$/' "$TMP" > "$TMP.clean"
mv "$TMP.clean" "$TMP"
if [ -s "$TMP" ] && [ "$(tail -c 1 "$TMP" | wc -l)" -eq 0 ]; then
  printf '\n' >> "$TMP"
fi

{
  printf '%s\n' "$MARK_BEGIN"
  printf '%s\n' '- insert:'
  printf '%s\n' '    - id: session-cost'
  printf '      name: %s\n' "$ENTRY"
  printf '%s\n' "$MARK_END"
} >> "$TMP"

mv "$TMP" "$PATCH"
trap - EXIT

printf '\nInstalled %s\n' "$PLUGIN_NAME"
printf '  plugin:  %s\n' "$DEST"
printf '  profile: %s\n' "$PROFILE"
printf '  patch:   %s\n' "$PATCH"
printf '  backup:  %s\n' "$PATCH.bak.$STAMP"
printf '\nRestart DSH (or wait for the live profile reload), then refresh the browser tab.\n'
