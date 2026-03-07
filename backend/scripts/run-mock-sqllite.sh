#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Deprecated compatibility wrapper.
echo "[DEPRECATED] run-mock-sqllite.sh is deprecated. Use run-mock.sh with DB_DRIVER set explicitly."
export DB_DRIVER_OVERRIDE=sqlite

exec "$SCRIPT_DIR/run-mock.sh"
