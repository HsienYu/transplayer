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
for tool in timeout xset gdbus sleep; do
  if ! command -v "$tool" >/dev/null; then
    printf 'Required desktop tool missing: %s\n' "$tool" >&2
    exit 78
  fi
done

trap 'exit 0' INT TERM
printf '%s\n' 'Waiting for the logged-in X11/GNOME desktop'
while :; do
  if timeout 5 xset q >/dev/null 2>&1; then
    # A display socket alone may belong to the login screen, not the user's desktop.
    ready=$(timeout 5 gdbus call --session --dest org.gnome.Shell \
      --object-path /org/gnome/Shell --method org.gnome.Shell.Eval \
      '(function(){var e=imports.misc.extensionUtils.extensions["ubuntu-dock@ubuntu.com"];return !!imports.ui.main.panel.actor && !!e && !!e.imports.extension.dockManager;})()' \
      2>/dev/null) || ready=
    if [ "$ready" = "(true, 'true')" ]; then
      break
    fi
  fi
  sleep 3
done
printf '%s\n' 'DESKTOP_READY'
if [ "${2:-}" = "--check" ]; then
  exit 0
fi
exec "$1"
