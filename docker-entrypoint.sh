#!/bin/sh
set -eu

echo "Starting BLCH Voting DApp frontend"
echo "NODE_ENV=${NODE_ENV:-production}"
echo "HOST=${HOST:-0.0.0.0}"
echo "PORT=${PORT:-3000}"

if [ "${SEPOLIA_PRIVATE_KEY:-}" != "" ]; then
  echo "ERROR: SEPOLIA_PRIVATE_KEY must not be provided to the frontend container." >&2
  echo "Deploy contracts outside the image/container, then build the frontend image with exported addresses." >&2
  exit 1
fi

if [ "${SEPOLIA_RPC_URL:-}" != "" ]; then
  echo "WARNING: SEPOLIA_RPC_URL is not used by the frontend runtime container." >&2
fi

exec "$@"
