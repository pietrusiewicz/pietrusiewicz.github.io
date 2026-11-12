#!/usr/bin/env bash
# Remove dsh-session-cost from a DSH profile on Linux or macOS.
#
# Usage:
#   ./install/uninstall-linux.sh [profile]
set -euo pipefail

PROFILE="${1:-web}"
PLUGIN_NAME="dsh-session-cost"
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

[ -f "$PATCH" ] || die "patch file not found: $PATCH"

STAMP="$(date +%Y%m%d-%H%M%S)"
cp "$PATCH" "$PATCH.bak.$STAMP"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

awk -v begin="$MARK_BEGIN" -v end="$MARK_END" '
  $0 == begin { skip = 1; removed = 1; next }
  $0 == end   { skip = 0; next }
  !skip       { print }
  END         { exit removed ? 0 : 3 }
' "$PATCH" > "$TMP" || {
  status=$?
  if [ "$status" -eq 3 ]; then
    printf 'No managed dsh-session-cost block found in %s\n' "$PATCH"
    exit 0
  fi
  exit "$status"
}

CONTENT="$(awk '
  {
    line = $0
    sub(/#.*/, "", line)
    gsub(/[[:space:]]/, "", line)
    if (line != "") print line
  }
' "$TMP" | tr -d '\n')"
if [ -z "$CONTENT" ] || [ "$CONTENT" = "[]" ]; then
  printf '[]\n' > "$TMP"
fi

mv "$TMP" "$PATCH"
trap - EXIT

if [ -e "$DEST" ]; then
  INSTALLED_NAME="$(node -e 'try { process.stdout.write(require(process.argv[1]).name) } catch {}' "$DEST/package.json" 2>/dev/null || true)"
  if [ "$INSTALLED_NAME" = "$PLUGIN_NAME" ]; then
    rm -rf "$DEST"
    printf 'Removed %s\n' "$DEST"
  else
    printf 'Left %s untouched: it is not %s\n' "$DEST" "$PLUGIN_NAME"
  fi
fi

printf 'Removed the dsh-session-cost entry from %s\n' "$PATCH"
printf '  backup: %s\n' "$PATCH.bak.$STAMP"
printf 'Restart DSH, then refresh the browser tab.\n'
