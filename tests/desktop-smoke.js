const { fork, execFileSync } = require("child_process");
const assert = require("assert");
const path = require("path");
const env = Object.assign({}, process.env, {
  ELECTRON_RUN_AS_NODE: "1",
  DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${process.getuid()}/bus`,
});
function evaluate(expression) {
  return execFileSync("gdbus", [
    "call", "--session", "--dest", "org.gnome.Shell", "--object-path",
    "/org/gnome/Shell", "--method", "org.gnome.Shell.Eval", expression,
  ], { env, encoding: "utf8", timeout: 5000 }).trim();
}
const baseline = '!global._transplayerDesktop && imports.ui.main.panel.actor.visible && imports.misc.extensionUtils.extensions["ubuntu-dock@ubuntu.com"].imports.extension.dockManager._allDocks.every(function(d){return d.actor.visible;})';
assert.equal(evaluate(baseline), "(true, 'true')");
const child = fork(path.join(process.env.TRANSPLAYER_APP_ROOT, "desktop-guard.js"), [], {
  execPath: process.execPath, env,
});
let ready = false;
const timer = setTimeout(() => { child.kill("SIGTERM"); process.exitCode = 1; }, 12000);
child.on("message", message => {
  assert.equal(message.ready, true);
  assert.equal(evaluate("!!global._transplayerDesktop && global._transplayerDesktop.items.every(function(i){return !i.actor.visible;})"), "(true, 'true')");
  assert.equal(evaluate("global._transplayerDesktop.dockFilters.length > 0 && global._transplayerDesktop.dockFilters.every(function(h){return h.target._handledWindow === h.wrapper;})"), "(true, 'true')");
  ready = true;
  // A lost parent IPC channel follows the same restoration path as an app crash.
  child.disconnect();
});
child.on("exit", code => {
  clearTimeout(timer);
  assert.equal(code, 0);
  assert(ready);
  assert.equal(evaluate(baseline), "(true, 'true')");
  console.log("DESKTOP_DISCONNECT_SMOKE PASS");
});
