# Sourced by Holly launcher — not for direct execution.
setup_node_path() {
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

  if [[ -s "${HOME}/.fnm/fnm" ]]; then
    # shellcheck disable=SC1091
    eval "$("${HOME}/.fnm/fnm" env)"
  elif command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
  fi

  if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1091
    . "${HOME}/.nvm/nvm.sh"
  fi

  if [[ -d "${HOME}/.volta/bin" ]]; then
    export PATH="${HOME}/.volta/bin:${PATH}"
  fi
}
