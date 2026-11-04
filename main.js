const { app, BrowserWindow, screen, ipcMain, dialog, globalShortcut } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const { pathToFileURL } = require("url");
const { canvasBounds, loadConfig } = require("./portable");

let win;
let worker;
let desktopGuard;
let stopping = false;

app.setName("Transplayer");
app.setPath("userData", path.join(app.getPath("appData"), "transplayer-portable"));
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  globalShortcut.unregisterAll();
  if (win && !win.isDestroyed()) win.destroy();
  await Promise.all([worker, desktopGuard].map(child => new Promise(resolve => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    const timer = setTimeout(() => {
      console.error("Owned child shutdown timed out");
      code = code || 1;
      try {
        if (child === worker) process.kill(-child.pid, "SIGTERM");
        else child.kill("SIGTERM");
      } catch (error) { if (error.code !== "ESRCH") console.error(error); }
      resolve();
    }, 10000);
    child.once("exit", childCode => {
      clearTimeout(timer);
      if (childCode) code = code || 1;
      resolve();
    });
    if (child.connected) child.send({ stop: true });
    else child.kill("SIGTERM");
  })));
  app.exit(code);
}

function fail(error) {
  console.error(error.stack || error);
  if (process.env.TRANSPLAYER_NONINTERACTIVE !== "1") {
    dialog.showErrorBox("Transplayer", error.message || String(error));
  }
  stop(1);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    if (argv.includes("--stop")) stop();
  });
  app.on("before-quit", event => { if (!stopping) { event.preventDefault(); stop(); } });
  process.on("SIGTERM", () => stop());
  process.on("SIGINT", () => stop());
  app.on("ready", async () => {
    try {
      if (process.argv.includes("--stop")) return app.exit(0);
      const config = loadConfig(process.env.TRANSPLAYER_CONFIG);
      const displays = screen.getAllDisplays();
      const bounds = canvasBounds(displays.map(display => display.bounds));
      console.log("DISPLAY", JSON.stringify({ count: displays.length, bounds }));
      if (displays.length !== 2 || bounds.width !== config.expectedWidth ||
          bounds.height !== config.expectedHeight) {
        throw new Error(`Display mismatch: ${displays.length} displays, ${bounds.width}x${bounds.height}; expected 2 displays, ${config.expectedWidth}x${config.expectedHeight}`);
      }
      process.env.TRANSPLAYER_ORIGIN_X = String(bounds.x);
      process.env.TRANSPLAYER_ORIGIN_Y = String(bounds.y);
      worker = fork(path.join(__dirname, "sub-process.js"), [], {
        cwd: __dirname, execPath: process.execPath, detached: true,
        env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Controller startup timed out")), 10000);
        worker.once("error", error => { clearTimeout(timer); reject(error); });
        worker.once("exit", code => {
          clearTimeout(timer);
          if (!stopping) {
            reject(new Error(`Controller exited: ${code}`));
            if (win) fail(new Error(`Controller exited: ${code}`));
          }
        });
        worker.once("message", message => {
          clearTimeout(timer);
          if (message.ready) resolve();
          else reject(new Error("Controller failed to become ready"));
        });
      });
      if (stopping) return;
      desktopGuard = fork(path.join(__dirname,
        process.env.TRANSPLAYER_DESKTOP_BACKEND === "gnome49" ?
          "desktop-modern-guard.js" : "desktop-guard.js"), [], {
        cwd: __dirname, execPath: process.execPath,
        env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Desktop guard startup timed out")), 10000);
        desktopGuard.once("error", error => { clearTimeout(timer); reject(error); });
        desktopGuard.once("exit", code => {
          clearTimeout(timer);
          if (!stopping) {
            reject(new Error(`Desktop guard exited: ${code}`));
            if (win) fail(new Error("Desktop guard exited during playback"));
          }
        });
        desktopGuard.once("message", message => {
          clearTimeout(timer);
          if (message.ready) resolve();
          else reject(new Error("Desktop guard did not become ready"));
        });
      });
      if (stopping) return;
      ipcMain.handle("playback-config", () => ({
        videoURL: pathToFileURL(config.videoPath).href,
        startSeconds: config.startSeconds,
      }));
      ipcMain.on("playback-status", (event, status) => {
        if (win && event.sender === win.webContents) {
          console.log("PLAYBACK", JSON.stringify(status));
          if (status.error) fail(new Error(status.error));
        }
      });
      win = new BrowserWindow(Object.assign({}, bounds, {
        title: "Transplayer", focusable: false, transparent: true,
        backgroundColor: "#00000000", frame: false, fullscreen: false,
        alwaysOnTop: true, skipTaskbar: true, resizable: false,
        enableLargerThanScreen: true,
        webPreferences: {
          nodeIntegration: false, contextIsolation: true,
          preload: path.join(__dirname, "app/preload.js"),
        },
      }));
      win.setIgnoreMouseEvents(true);
      win.setBounds(bounds);
      win.on("closed", () => { win = null; stop(); });
      win.webContents.on("will-navigate", event => event.preventDefault());
      win.webContents.on("new-window", event => event.preventDefault());
      win.webContents.on("render-process-gone", () => fail(new Error("Video renderer exited")));
      await win.loadFile(path.join(__dirname, "app/index.html"));
      if (!globalShortcut.register("CommandOrControl+Alt+Q", () => stop())) {
        console.warn("Stop shortcut unavailable; use the Stop desktop entry");
      }
      console.log("WINDOW", JSON.stringify(win.getBounds()));
      const seconds = Number(process.env.TRANSPLAYER_SMOKE_SECONDS);
      if (seconds > 0) setTimeout(() => stop(), seconds * 1000);
    } catch (error) { fail(error); }
  });
}
