#!/bin/bash
# Start a local Temporal Server for the migration demo.
# Uses file-based (SQLite) persistence so Workflow state survives restarts.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_FILE="$SCRIPT_DIR/temporal-data/temporal.db"

mkdir -p "$SCRIPT_DIR/temporal-data"

echo "Starting local Temporal Server..."
echo "  DB file:  $DB_FILE"
echo "  Address:  localhost:7233"
echo "  UI:       http://localhost:8233"
echo ""

temporal server start-dev \
  --db-filename "$DB_FILE" \
  --ui-port 8233 \
  --log-format pretty
