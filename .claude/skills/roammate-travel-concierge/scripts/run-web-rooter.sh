#!/usr/bin/env bash
set -euo pipefail

load_env_file() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || return 0

  while IFS='=' read -r key value; do
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ -z "${key}" || "${key}" == \#* ]] && continue
    [[ "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"

    if [[ -z "${!key:-}" ]]; then
      export "${key}=${value}"
    fi
  done < "${env_file}"
}

load_env_file ".env"

export WEB_ROOTER_NO_RICH="${WEB_ROOTER_NO_RICH:-1}"
export WEB_ROOTER_MAX_OUTPUT_CHARS="${WEB_ROOTER_MAX_OUTPUT_CHARS:-12000}"

if command -v wr >/dev/null 2>&1; then
  exec wr "$@"
fi

candidates=()
if [[ -n "${WEB_ROOTER_HOME:-}" ]]; then
  candidates+=("${WEB_ROOTER_HOME}")
fi
candidates+=(
  "${HOME}/tools/web-rooter"
  "${HOME}/web-rooter"
  "$(pwd)/web-rooter"
)

for root in "${candidates[@]}"; do
  if [[ -f "${root}/main.py" ]]; then
    if [[ -x "${root}/.venv312/bin/python" ]]; then
      exec "${root}/.venv312/bin/python" "${root}/main.py" "$@"
    fi
    if [[ -x "${root}/.venv/bin/python" ]]; then
      exec "${root}/.venv/bin/python" "${root}/main.py" "$@"
    fi
    if command -v python3 >/dev/null 2>&1; then
      exec python3 "${root}/main.py" "$@"
    fi
    exec python "${root}/main.py" "$@"
  fi
done

cat >&2 <<'EOF'
Web-Rooter command not found.

Fix one of these:
1. Install Web-Rooter and ensure `wr` is on PATH:
   git clone https://github.com/baojiachen0214/web-rooter.git ~/tools/web-rooter
   cd ~/tools/web-rooter
   bash install.sh
   exec $SHELL -l

2. Or set WEB_ROOTER_HOME to an existing Web-Rooter checkout:
   export WEB_ROOTER_HOME="$HOME/tools/web-rooter"

3. Then verify:
   npm run doctor:webrooter
EOF
exit 127
