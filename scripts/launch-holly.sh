#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
source "$(dirname "${BASH_SOURCE[0]}")/resolve-root.sh"
ROOT="$(resolve_holly_root "${BASH_SOURCE[0]}")"
# shellcheck disable=SC1091
source "${ROOT}/scripts/env-node.sh"
setup_node_path

cd "${ROOT}"

PID_FILE="${ROOT}/.holly-dev.pid"
LOG_DIR="${ROOT}/logs"
LOG_FILE="${LOG_DIR}/holly-dev.log"
LAUNCH_LOG="${LOG_DIR}/holly-launch.log"

mkdir -p "${LOG_DIR}"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >>"${LAUNCH_LOG}"
}

read_env_port() {
  local key="$1"
  local default="$2"
  local port="${default}"
  if [[ -f "${ROOT}/.env" ]]; then
    local line
    line="$(grep -E "^${key}=" "${ROOT}/.env" 2>/dev/null | tail -n1 || true)"
    if [[ -n "${line}" ]]; then
      port="${line#*=}"
      port="${port// /}"
    fi
  fi
  echo "${port}"
}

notify() {
  osascript -e "display notification \"${2}\" with title \"${1}\"" 2>/dev/null || true
}

VITE_PORT="$(read_env_port VITE_PORT 5199)"
API_PORT="$(read_env_port PORT 3011)"

is_holly_healthy() {
  local web_port="$1"
  local api_port="$2"
  local web_code

  if ! curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${api_port}/api/health"; then
    return 1
  fi

  web_code="$(curl -s -o /dev/null --max-time 2 -w "%{http_code}" "http://localhost:${web_port}/" || echo 000)"
  [[ "${web_code}" == "200" || "${web_code}" == "304" ]]
}

find_healthy_web_port() {
  local api_port="$1"
  local preferred="$2"
  local p
  for p in "${preferred}" 5199 5173; do
    if is_holly_healthy "${p}" "${api_port}"; then
      echo "${p}"
      return 0
    fi
  done
  return 1
}

web_url_for_port() {
  echo "http://localhost:$1/"
}

open_ui() {
  local url="$1"
  log "open_ui ${url}"

  if open "${url}" >>"${LAUNCH_LOG}" 2>&1; then
    return 0
  fi

  log "open failed; trying Google Chrome"
  if open -a "Google Chrome" "${url}" >>"${LAUNCH_LOG}" 2>&1; then
    return 0
  fi

  osascript >>"${LAUNCH_LOG}" 2>&1 <<EOF || true
tell application "Google Chrome"
  activate
  open location "${url}"
end tell
EOF
}

stop_holly_dev() {
  local pid=""
  if [[ -f "${PID_FILE}" ]]; then
    pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  fi
  if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
    log "stopping holly dev pid=${pid}"
    pkill -P "${pid}" 2>/dev/null || true
    kill "${pid}" 2>/dev/null || true
    sleep 1
    if kill -0 "${pid}" 2>/dev/null; then
      kill -9 "${pid}" 2>/dev/null || true
      pkill -9 -P "${pid}" 2>/dev/null || true
    fi
  fi
  rm -f "${PID_FILE}"
}

wait_for_healthy() {
  local api_port="$1"
  local preferred_web="$2"
  local tries="${3:-90}"
  local i found
  for ((i = 0; i < tries; i++)); do
    if found="$(find_healthy_web_port "${api_port}" "${preferred_web}")"; then
      echo "${found}"
      return 0
    fi
    sleep 0.5
  done
  return 1
}

log "launch ROOT=${ROOT} VITE_PORT=${VITE_PORT} API_PORT=${API_PORT}"

if found_port="$(find_healthy_web_port "${API_PORT}" "${VITE_PORT}")"; then
  log "already healthy on port ${found_port}"
  open_ui "$(web_url_for_port "${found_port}")"
  exit 0
fi

if [[ -f "${PID_FILE}" ]]; then
  old_pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" 2>/dev/null; then
    log "dev pid ${old_pid} running but unhealthy — restarting"
    stop_holly_dev
  else
    rm -f "${PID_FILE}"
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  log "npm not found"
  notify "Holly" "npm not found — install Node.js or fix your PATH"
  exit 1
fi

if [[ ! -d "${ROOT}/node_modules" ]]; then
  notify "Holly" "Run npm install in the Holly project first"
  exit 1
fi

if [[ ! -f "${ROOT}/.env" ]]; then
  notify "Holly" "Copy .env.example to .env and set LLM_API_KEY"
  exit 1
fi

{
  echo "----- $(date '+%Y-%m-%d %H:%M:%S %z') Holly dev start -----"
  npm run dev
} >>"${LOG_FILE}" 2>&1 &
dev_pid=$!
echo "${dev_pid}" >"${PID_FILE}"
log "started npm run dev pid=${dev_pid}"

if found_port="$(wait_for_healthy "${API_PORT}" "${VITE_PORT}" 90)"; then
  open_ui "$(web_url_for_port "${found_port}")"
  notify "Holly" "Opened in your browser"
  log "success on port ${found_port}"
  exit 0
fi

if kill -0 "${dev_pid}" 2>/dev/null; then
  log "timeout waiting for healthy servers"
  notify "Holly" "Still starting — see logs/holly-dev.log and holly-launch.log"
  exit 1
fi

rm -f "${PID_FILE}"
log "dev process exited early"
notify "Holly" "Dev server exited — see logs/holly-dev.log"
exit 1
