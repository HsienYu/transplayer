const os = require("os");
const path = require("path");

const home = os.homedir();
const runtime = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid()}`;

module.exports = {
  apps: [{
    name: "transplayer",
    cwd: __dirname,
    script: path.join(__dirname, "packaging/pm2-launch.sh"),
    interpreter: "/bin/sh",
    // AppRun execs Electron directly, so PM2 signals reach the actual app,
    // rather than an AppImage mounting/launcher process.
    args: ["/opt/transplayer/releases/r9.AppDir/AppRun"],
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    restart_delay: 10000,
    min_uptime: 20000,
    max_restarts: 30,
    // PM2 7.1.1 reports code 0 for some SIGKILL exits. Only the
    // deliberate desktop/configuration refusal must suppress restart.
    stop_exit_codes: [78],
    kill_timeout: 20000,
    treekill: false,
    watch: false,
    merge_logs: true,
    log_date_format: "YYYY-MM-DDTHH:mm:ssZ",
    env: {
      ...(process.env.DISPLAY ? { DISPLAY: process.env.DISPLAY } : {}),
      XDG_RUNTIME_DIR: runtime,
      ...(process.env.XAUTHORITY ? { XAUTHORITY: process.env.XAUTHORITY } : {}),
      DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS || `unix:path=${runtime}/bus`,
      TRANSPLAYER_CONFIG: process.env.TRANSPLAYER_CONFIG || path.join(home, ".config/transplayer/config.json"),
      TRANSPLAYER_NONINTERACTIVE: "1",
    },
  }],
};
