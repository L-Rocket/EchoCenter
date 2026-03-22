#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="${OPENHANDS_RUNTIME_DIR:-$SCRIPT_DIR/.runtime}"
PYTHON_VERSION="${OPENHANDS_PYTHON_VERSION:-3.12.12}"
PYTHON_PREFIX="$RUNTIME_DIR/python-$PYTHON_VERSION"
PYTHON_BIN="$PYTHON_PREFIX/bin/python3"
PYTHON_TARBALL="$RUNTIME_DIR/Python-$PYTHON_VERSION.tgz"
PYTHON_SRC_DIR="$RUNTIME_DIR/Python-$PYTHON_VERSION"
PYTHON_URL="${OPENHANDS_PYTHON_URL:-https://www.python.org/ftp/python/$PYTHON_VERSION/Python-$PYTHON_VERSION.tgz}"

if [ -x "$PYTHON_BIN" ]; then
  echo "$PYTHON_BIN"
  exit 0
fi

mkdir -p "$RUNTIME_DIR"

if [ ! -s "$PYTHON_TARBALL" ]; then
  echo "Downloading Python $PYTHON_VERSION source archive..."
  curl --fail --location --retry 5 --retry-delay 2 --http1.1 \
    --output "$PYTHON_TARBALL" \
    "$PYTHON_URL"
fi

if [ ! -d "$PYTHON_SRC_DIR" ]; then
  echo "Extracting Python $PYTHON_VERSION sources..."
  tar -xzf "$PYTHON_TARBALL" -C "$RUNTIME_DIR"
fi

OPENSSL_PREFIX="${OPENSSL_PREFIX:-$(brew --prefix openssl@3)}"
READLINE_PREFIX="${READLINE_PREFIX:-$(brew --prefix readline)}"
SQLITE_PREFIX="${SQLITE_PREFIX:-$(brew --prefix sqlite)}"
XZ_PREFIX="${XZ_PREFIX:-$(brew --prefix xz)}"

export CPPFLAGS="-I$OPENSSL_PREFIX/include -I$READLINE_PREFIX/include -I$SQLITE_PREFIX/include -I$XZ_PREFIX/include ${CPPFLAGS:-}"
export LDFLAGS="-L$OPENSSL_PREFIX/lib -L$READLINE_PREFIX/lib -L$SQLITE_PREFIX/lib -L$XZ_PREFIX/lib ${LDFLAGS:-}"
export PKG_CONFIG_PATH="$OPENSSL_PREFIX/lib/pkgconfig:$READLINE_PREFIX/lib/pkgconfig:$SQLITE_PREFIX/lib/pkgconfig:$XZ_PREFIX/lib/pkgconfig:${PKG_CONFIG_PATH:-}"

cd "$PYTHON_SRC_DIR"

echo "Configuring local Python runtime under $PYTHON_PREFIX..."
./configure \
  --prefix="$PYTHON_PREFIX" \
  --with-openssl="$OPENSSL_PREFIX" \
  --enable-optimizations \
  --with-ensurepip=install >/dev/null

echo "Building Python $PYTHON_VERSION..."
make -j"$(sysctl -n hw.ncpu)" >/dev/null

echo "Installing Python $PYTHON_VERSION..."
make install >/dev/null

echo "$PYTHON_BIN"
