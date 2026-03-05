#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Backward-compatible entrypoint; keep historical reset behavior.
exec "$SCRIPT_DIR/run-mock.sh"
