const { execFileSync } = require("child_process");
const crypto = require("crypto");
const { desktopScript } = require("./desktop-state");
const owner = crypto.randomBytes(16).toString("hex");
let stopped = false;

function call(action) {
  const output = execFileSync("gdbus", [
    "call", "--session", "--dest", "org.gnome.Shell",
    "--object-path", "/org/gnome/Shell", "--method", "org.gnome.Shell.Eval",
    desktopScript(action, owner),
  ], {
    encoding: "utf8", timeout: 5000,
    env: Object.assign({}, process.env, {
      DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS ||
        `unix:path=/run/user/${process.getuid()}/bus`,
    }),
  }).trim();
  if (output !== "(true, 'true')") throw new Error(`GNOME desktop ${action} failed: ${output}`);
}

function stop() {
  if (stopped) return;
  stopped = true;
  try {
    call("restore");
    console.log("DESKTOP_RESTORED");
    process.exit(0);
  } catch (error) {
    console.error(error.stack);
    process.exit(1);
  }
}
process.on("message", message => { if (message.stop) stop(); });
process.on("disconnect", stop);
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
try {
  call("hide");
  console.log("DESKTOP_HIDDEN");
  if (process.send) process.send({ ready: true });
  else stop();
} catch (error) {
  console.error(error.stack);
  stop();
}
