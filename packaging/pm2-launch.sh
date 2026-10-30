#!/bin/sh
set -eu

if [ "$#" -lt 1 ] || [ ! -x "$1" ]; then
  printf '%s\n' 'Transplayer executable (AppImage/AppRun) is missing or not executable' >&2
  exit 78
fi
if [ "$#" -gt 2 ] || { [ "$#" -eq 2 ] && [ "$2" != "--check" ]; }; then
  printf '%s\n' 'Usage: pm2-launch.sh EXECUTABLE [--check]' >&2
  exit 78
fi
if [ -z "${DISPLAY:-}" ] || [ -z "${XDG_RUNTIME_DIR:-}" ] ||
   [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ] ||
   [ -z "${XAUTHORITY:-}" ] || [ ! -r "$XAUTHORITY" ]; then
  printf '%s\n' 'Authenticated graphical session is unavailable' >&2
  exit 78
fi
for tool in timeout xset gdbus sleep; do
  if ! command -v "$tool" >/dev/null; then
    printf 'Required desktop tool missing: %s\n' "$tool" >&2
    exit 78
  fi
done
attempts=${TRANSPLAYER_READY_ATTEMPTS:-60}
case "$attempts" in
  ''|*[!0-9]*) printf '%s\n' 'Invalid desktop readiness attempt count' >&2; exit 78 ;;
esac
if [ "$attempts" -lt 1 ] || [ "$attempts" -gt 60 ]; then
  printf '%s\n' 'Desktop readiness attempt count must be 1..60' >&2
  exit 78
fi

trap 'exit 0' INT TERM
printf '%s\n' 'Waiting for the logged-in GNOME 49 desktop'
remaining=$attempts
while [ "$remaining" -gt 0 ]; do
  if timeout 5 xset q >/dev/null 2>&1; then
    ready=$(timeout 5 gdbus call --session --dest org.gnome.Shell \
      --object-path /org/gnome/Shell/Extensions/Transplayer \
      --method org.transplayer.Desktop.Status 2>/dev/null) || ready=
    case "$ready" in
      *'"revision":2'*'"active":false'*'"panelVisible":true'*) break ;;
    esac
  fi
  remaining=$((remaining - 1))
  if [ "$remaining" -eq 0 ]; then
    printf '%s\n' 'GNOME 49 desktop not ready after bounded wait' >&2
    exit 78
  fi
  sleep 3
done
printf '%s\n' 'DESKTOP_READY'
if [ "${2:-}" = "--check" ]; then
  exit 0
fi
exec "$1"
