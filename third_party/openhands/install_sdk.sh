#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENDOR_DIR="$SCRIPT_DIR/vendor"
SDK_COMMIT="${OPENHANDS_SDK_COMMIT:-703151e01f7b477cf3c8e45d1d57c562fab50823}"
SDK_ARCHIVE="${OPENHANDS_SDK_ARCHIVE:-$VENDOR_DIR/software-agent-sdk-${SDK_COMMIT}.zip}"
SDK_URL="${OPENHANDS_SDK_ARCHIVE_URL:-https://codeload.github.com/OpenHands/software-agent-sdk/zip/${SDK_COMMIT}}"
PIP_BIN="${PIP_BIN:-pip3}"

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
  echo "Installing OpenHands SDK from local archive..."
  "$PIP_BIN" install "$SDK_ARCHIVE"
}

download_archive
install_archive
