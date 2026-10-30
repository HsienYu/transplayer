#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  printf '%s\n' 'Usage: pm2-session.sh login|start|stop|status' >&2
  exit 78
fi
case "$1" in
  login|start|stop|status) action=$1 ;;
  *) printf '%s\n' 'Unsupported Transplayer PM2 action' >&2; exit 78 ;;
esac
if [ "$(id -u)" -eq 0 ]; then
  printf '%s\n' 'Never run the exhibition player as root' >&2
  exit 78
fi

tools=$HOME/.local/share/transplayer/tools
node=$tools/node-v24.22.2-linux-x64/bin/node
pm2=$tools/pm2-7.1.1/node_modules/.bin/pm2
supervisor=$HOME/.local/share/transplayer/supervisor/r9-20261030-login-safe
export PATH="$tools/node-v24.22.2-linux-x64/bin:$PATH"
export PM2_HOME="$HOME/.local/share/transplayer/pm2-state"
if [ ! -x "$node" ] || [ ! -x "$pm2" ] ||
   [ ! -f "$supervisor/ecosystem.config.js" ]; then
  printf '%s\n' 'Pinned PM2 supervisor files are missing' >&2
  exit 78
fi
if [ "$action" = stop ]; then
  exec "$pm2" stop transplayer
fi
if [ "$action" = status ]; then
  exec "$pm2" ls
fi
if [ -z "${DISPLAY:-}" ] || [ -z "${XDG_RUNTIME_DIR:-}" ] ||
   [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ] ||
   [ -z "${XAUTHORITY:-}" ] || [ ! -r "$XAUTHORITY" ]; then
  printf '%s\n' 'Current graphical-session authentication is unavailable' >&2
  exit 78
fi

"$pm2" ping >/dev/null
state=$("$pm2" jlist | "$node" -e '
  let apps;
  try { apps = JSON.parse(require("fs").readFileSync(0, "utf8")); }
  catch (_) { process.stderr.write("Invalid isolated PM2 response\n"); process.exit(78); }
  if (!Array.isArray(apps)) process.exit(78);
  if (apps.length === 0) process.stdout.write("empty");
  else if (apps.length === 1 && apps[0].name === "transplayer" &&
           apps[0].pm2_env &&
           ["online", "stopped"].includes(apps[0].pm2_env.status)) {
    if (apps[0].pm2_env.status === "online" &&
        (apps[0].pm2_env.pm_exec_path !==
          require("path").join(process.env.HOME,
            ".local/share/transplayer/supervisor/r9-20261030-login-safe/packaging/pm2-launch.sh") ||
         apps[0].pm2_env.XAUTHORITY !== process.env.XAUTHORITY ||
         apps[0].pm2_env.DISPLAY !== process.env.DISPLAY)) {
      process.stderr.write("Online player belongs to another supervisor or graphical login\n");
      process.exit(78);
    }
    process.stdout.write(apps[0].pm2_env.status);
  } else {
    process.stderr.write("Unexpected isolated PM2 app state\n");
    process.exit(78);
  }
') || exit 78
case "$state" in
  online)
    printf '%s\n' 'Transplayer is already running; not restarting'
    exit 0 ;;
  stopped|empty)
    # Only a new launch requires an idle desktop and the current GNOME
    # extension. A running instance already owns the desktop lease.
    "$supervisor/packaging/pm2-launch.sh" \
      /opt/transplayer/releases/r9.AppDir/AppRun --check || exit 78 ;;
  *) printf '%s\n' 'Invalid isolated PM2 state' >&2; exit 78 ;;
esac
case "$state" in
  stopped)
    # PM2 retains the old per-process environment across restart -- replace
    # only our stopped definition so the current session credentials are used.
    "$pm2" delete transplayer >/dev/null ;;
  empty) ;;
esac
exec "$pm2" start "$supervisor/ecosystem.config.js" --only transplayer
