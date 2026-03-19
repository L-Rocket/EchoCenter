#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENDOR_DIR="$SCRIPT_DIR/vendor"
SDK_COMMIT="${OPENHANDS_SDK_COMMIT:-703151e01f7b477cf3c8e45d1d57c562fab50823}"
SDK_ARCHIVE="${OPENHANDS_SDK_ARCHIVE:-$VENDOR_DIR/software-agent-sdk-${SDK_COMMIT}.zip}"
SDK_URL="${OPENHANDS_SDK_ARCHIVE_URL:-https://codeload.github.com/OpenHands/software-agent-sdk/zip/${SDK_COMMIT}}"
EXTRACT_ROOT="$VENDOR_DIR/extracted"
EXTRACT_DIR="$EXTRACT_ROOT/software-agent-sdk-${SDK_COMMIT}"
DEFAULT_PYTHON_BIN="$SCRIPT_DIR/.runtime/python-3.12.12/bin/python3"
if [ -x "$DEFAULT_PYTHON_BIN" ]; then
  PYTHON_BIN="${PYTHON_BIN:-$DEFAULT_PYTHON_BIN}"
else
  PYTHON_BIN="${PYTHON_BIN:-python3}"
fi

mkdir -p "$VENDOR_DIR"

download_archive() {
  if [ -s "$SDK_ARCHIVE" ]; then
    echo "Using cached OpenHands SDK archive: $SDK_ARCHIVE"
    return
  fi

  echo "Downloading OpenHands SDK archive..."
  curl --fail --location --retry 5 --retry-delay 2 --http1.1 \
    --output "$SDK_ARCHIVE" \
    "$SDK_URL"
}

install_archive() {
  echo "Preparing extracted OpenHands SDK workspace..."
  mkdir -p "$EXTRACT_ROOT"
  if [ ! -d "$EXTRACT_DIR" ]; then
    "$PYTHON_BIN" - <<'PY' "$SDK_ARCHIVE" "$EXTRACT_ROOT"
import pathlib
import sys
import zipfile

archive = pathlib.Path(sys.argv[1])
dest = pathlib.Path(sys.argv[2])
with zipfile.ZipFile(archive) as zf:
    zf.extractall(dest)
PY
  fi

  echo "Installing OpenHands SDK packages from extracted workspace..."
  "$PYTHON_BIN" -m pip install "$EXTRACT_DIR/openhands-sdk"
}

download_archive
install_archive
