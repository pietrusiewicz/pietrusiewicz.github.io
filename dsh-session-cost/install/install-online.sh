#!/usr/bin/env bash
# Download and install dsh-session-cost without keeping a local clone.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/pietrusiewicz/pietrusiewicz.github.io/main/dsh-session-cost/install/install-online.sh | bash
#   curl -fsSL ... | bash -s -- tui
#
# The profile defaults to "web". Set DSH_HOME for a non-default DSH home,
# or DSH_SESSION_COST_REF to install another branch or tag.
set -euo pipefail

PROFILE="${1:-web}"
REPO="pietrusiewicz/pietrusiewicz.github.io"
REF="${DSH_SESSION_COST_REF:-main}"
URL="https://github.com/$REPO/archive/refs/heads/$REF.tar.gz"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

command -v tar >/dev/null 2>&1 || die "tar is required."
if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q "$1" -O "$2"; }
else
  die "curl or wget is required."
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fetch "$URL" "$TMP/source.tar.gz"
tar -xzf "$TMP/source.tar.gz" -C "$TMP"

SRC="$(find "$TMP" -mindepth 2 -maxdepth 2 -type d -name dsh-session-cost | head -n 1)"
[ -n "$SRC" ] || die "dsh-session-cost not found in the downloaded archive."
[ -f "$SRC/install/install-linux.sh" ] || die "installer missing from the downloaded archive."

"$SRC/install/install-linux.sh" "$PROFILE"
