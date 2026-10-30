// Run as Electron (not ELECTRON_RUN_AS_NODE), with the installation stopped.
const { app, BrowserWindow, screen } = require("electron");
const { fork, execFileSync } = require("child_process");
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const root = process.env.TRANSPLAYER_APP_ROOT;
const { canvasBounds } = require(path.join(root, "portable"));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-dock-smoke-"));
process.env.TRANSPLAYER_PROFILE_DIR = profile;
const Controller = require(path.join(root, "controller"));
const controller = new Controller();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let overlay, guard;
app.disableHardwareAcceleration();
app.on("window-all-closed", () => {});

function evaluate(script) {
  const output = execFileSync("gdbus", [
    "call", "--session", "--dest", "org.gnome.Shell", "--object-path",
    "/org/gnome/Shell", "--method", "org.gnome.Shell.Eval", script,
  ], { encoding: "utf8", timeout: 5000 }).trim();
  assert(output.startsWith("(true,"), output);
  return output;
}
function state() {
  // Shell Eval JSON-serializes its result, then gdbus quotes that string again.
  // URI encoding keeps the payload free of GVariant quote/backslash escapes.
  const output = evaluate('encodeURIComponent(JSON.stringify({owned:!!global._transplayerDesktop,panel:imports.ui.main.panel.actor.visible,docks:imports.misc.extensionUtils.extensions["ubuntu-dock@ubuntu.com"].imports.extension.dockManager._allDocks.map(function(d){return {visible:d.actor.visible,slide:d._slider._slidex,overlap:d._intellihide.getOverlapStatus()};})}))');
  return JSON.parse(decodeURIComponent(JSON.parse(output.slice(output.indexOf("'") + 1, output.lastIndexOf("'")))));
}

app.on("ready", async () => {
  let code = 0;
  try {
    const before = state();
    assert(!before.owned && before.panel, "Stop the installation before this probe");
    assert(before.docks.length > 0);
    assert(before.docks.every(d => !d.overlap), "An unrelated window overlaps the Dock; do not close it automatically");
    const bounds = canvasBounds(screen.getAllDisplays().map(d => d.bounds));
    overlay = new BrowserWindow(Object.assign({}, bounds, {
      transparent: true, backgroundColor: "#00000000", frame: false,
      focusable: false, alwaysOnTop: true, skipTaskbar: true,
      enableLargerThanScreen: true, webPreferences: { nodeIntegration: false },
    }));
    overlay.setIgnoreMouseEvents(true);
    await overlay.loadURL("data:text/html,<body style='margin:0;background:transparent'></body>");
    guard = fork(path.join(root, "desktop-guard.js"), [], {
      execPath: process.execPath,
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Guard readiness timeout")), 10000);
      guard.once("message", message => {
        clearTimeout(timeout);
        if (message.ready) resolve(); else reject(new Error("Guard not ready"));
      });
      guard.once("error", reject);
      guard.once("exit", () => reject(new Error("Guard exited before probe")));
    });
    await sleep(1500);
    const transparent = state();
    console.log("DOCK_TRANSPARENT_ONLY", JSON.stringify(transparent));
    assert(!transparent.panel && transparent.owned);
    assert(transparent.docks.every(d => d.visible && !d.overlap && d.slide > 0.99));
    assert(await controller.goTo(0, "data:text/html,<body style='height:6000px'>Synthetic Dock verification</body>"));
    assert(await controller.setBrowserRect(0, { x: bounds.x, y: bounds.y, width: 1080, height: 1920 }));
    await sleep(1500);
    const covered = state();
    console.log("DOCK_BROWSER_COVERING", JSON.stringify(covered));
    assert(covered.docks[0].overlap && covered.docks[0].slide < 0.01);
    assert(await controller.closeBrowser(0));
    await sleep(1500);
    const closed = state();
    console.log("DOCK_BROWSER_CLOSED", JSON.stringify(closed));
    assert(closed.docks.every(d => d.visible && !d.overlap && d.slide > 0.99));
  } catch (error) {
    console.error(error.stack);
    code = 1;
  } finally {
    try {
      const results = await controller.closeAllBrowser();
      assert(results.every(Boolean));
      if (overlay && !overlay.isDestroyed()) overlay.destroy();
      if (guard && guard.exitCode === null && guard.signalCode === null) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Guard cleanup timeout")), 10000);
          guard.once("exit", result => { clearTimeout(timer); result === 0 ? resolve() : reject(new Error("Guard cleanup failed")); });
          if (guard.connected) guard.send({ stop: true }); else guard.kill("SIGTERM");
        });
      }
      const restored = state();
      assert(!restored.owned && restored.panel);
      fs.rmdirSync(profile, { recursive: true });
      console.log("DOCK_SMOKE", code === 0 ? "PASS" : "FAIL");
    } catch (error) { console.error(error.stack); code = 1; }
    app.exit(code);
  }
});
