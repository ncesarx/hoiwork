#!/usr/bin/env bash
set -euo pipefail

APP_URL="${HOIWORK_APP_URL:-http://127.0.0.1:3000}"
SECRET="${HOIWORK_AUTOMATION_SECRET:-}"

if [[ -z "$SECRET" ]]; then
  echo "HOIWORK_AUTOMATION_SECRET ausente." >&2
  exit 2
fi

exec curl -fsS \
  -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  "${APP_URL%/}/api/incidents/sla/scheduler-run"
