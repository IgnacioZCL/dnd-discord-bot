#!/bin/bash
set -e

echo "[entrypoint] Starting dnd-discord-bot container..."
echo "[entrypoint] Running as user: $(id -un) ($(id -u))"

# Verify gosu is available.
if ! command -v gosu > /dev/null 2>&1; then
  echo "[entrypoint] ERROR: gosu not found. Falling back to running as current user."
  exec node index.js
fi

# The container starts as root so it can fix permissions on the host-mounted volume.
mkdir -p /app/data
echo "[entrypoint] Fixing ownership of /app/data and /app..."
chown -R dnd:dnd /app/data || true
chown -R dnd:dnd /app || true

# Show final permissions for debugging.
echo "[entrypoint] /app/data owner: $(stat -c '%U:%G' /app/data)"
if [ -f /app/data/dnd.db ]; then
  echo "[entrypoint] /app/data/dnd.db owner: $(stat -c '%U:%G' /app/data/dnd.db)"
fi

# Drop to the non-root user before running the bot.
echo "[entrypoint] Launching bot as dnd..."
exec gosu dnd "$@"
