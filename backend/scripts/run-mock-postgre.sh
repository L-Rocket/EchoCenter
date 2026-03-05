#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Deprecated compatibility wrapper.
echo "[DEPRECATED] run-mock-postgre.sh is deprecated. Use run-mock.sh with DB_DRIVER=postgres."
export DB_DRIVER_OVERRIDE=postgres

exec "$SCRIPT_DIR/run-mock.sh"
