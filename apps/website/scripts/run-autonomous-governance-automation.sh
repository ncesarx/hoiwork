#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$APP_DIR"

set -a
[ -f .env ] && source .env
[ -f .env.local ] && source .env.local
set +a

APP_URL="${APP_URL:-http://127.0.0.1:3000}"
SECRET="${HOIWORK_AUTOMATION_SECRET:-}"

if [ -z "$SECRET" ]; then
  echo "HOIWORK_AUTOMATION_SECRET ausente." >&2
  exit 1
fi

curl \
  --fail \
  --silent \
  --show-error \
  --max-time 120 \
  -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  "${APP_URL%/}/api/observability/autonomous-governance/automation/scheduler-run"
