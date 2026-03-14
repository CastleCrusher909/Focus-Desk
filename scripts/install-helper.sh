#!/bin/bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo:"
  echo "  sudo /Users/jameswepsic/Desktop/ProgramsHome/focus-desk/scripts/install-helper.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${SCRIPT_DIR}/focusdesk-helper.c"
BIN="/usr/local/bin/focusdesk-helper"

clang "${SRC}" -o "${BIN}"
chown root:wheel "${BIN}"
chmod 4755 "${BIN}"

echo "Installed helper at ${BIN}"
