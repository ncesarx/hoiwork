#!/usr/bin/env bash
set -euo pipefail
APP_URL="${HOIWORK_APP_URL:-http://127.0.0.1:3000}"
if [ -z "${HOIWORK_AUTOMATION_SECRET:-}" ]; then echo "HOIWORK_AUTOMATION_SECRET não definida."; exit 1; fi
curl --fail --silent --show-error --max-time 120 -X POST -H "Authorization: Bearer ${HOIWORK_AUTOMATION_SECRET}" "${APP_URL}/api/observability/control-plane-slo/automation/scheduler-run"
echo
