# Shared by Holly launchers — not for direct execution.
resolve_holly_root() {
  local fallback_script="${1:-}"

  if [[ -n "${HOLLY_ROOT:-}" && -f "${HOLLY_ROOT}/package.json" ]]; then
    echo "${HOLLY_ROOT}"
    return 0
  fi

  if [[ -f "${HOME}/git/holly/package.json" ]]; then
    echo "${HOME}/git/holly"
    return 0
  fi

  if [[ -n "${fallback_script}" ]]; then
    echo "$(cd "$(dirname "${fallback_script}")/.." && pwd)"
    return 0
  fi

  return 1
}
