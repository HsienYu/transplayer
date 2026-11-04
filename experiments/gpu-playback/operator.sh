#!/bin/bash
# Diagnostic only. Authentication stays on the operator's terminal, outside logs.
set -o pipefail
umask 077
case "${1:-}" in
  --check|--run) action="$1" ;;
  *) printf '%s\n' 'Use --check or --run' >&2; exit 2 ;;
esac
if [ "$(id -u)" = 0 ]; then
  printf '%s\n' 'Run as the exhibition user, not root.' >&2
  exit 1
fi
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)" || exit 1
logs="$here/operator-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -m 700 -- "$logs" || exit 1
printf '%s\n' "Operator logs: $logs"
/usr/bin/sudo -v || exit 1
python3 "$here/run.py" --check --sudo-process-inspection 2>&1 | tee "$logs/check.log"
status=$?
if [ "$status" -ne 0 ]; then exit "$status"; fi
if [ "$action" = --run ]; then
  python3 "$here/run.py" --run --sudo-process-inspection 2>&1 | tee "$logs/run.log"
  exit "$?"
fi
