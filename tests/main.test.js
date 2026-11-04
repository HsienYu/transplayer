const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { canvasBounds } = require("../portable");

const root = path.join(__dirname, "..");

function fixture(options = {}) {
  const windows = [], children = [], switches = [], exits = [], errors = [];
  const timers = new Map();
  let hardwareDisabled = false;
  let unregistered = false;
  const app = new EventEmitter();
  Object.assign(app, {
    setName() {}, setPath() {}, getPath: () => "/synthetic/app-data",
    commandLine: { appendSwitch: (...args) => switches.push(args) },
    disableHardwareAcceleration: () => { hardwareDisabled = true; },
    requestSingleInstanceLock: () => options.lock !== false,
    quit: () => exits.push("quit"), exit: code => exits.push(code),
  });
  const ipcMain = new EventEmitter();
  const handlers = new Map();
  ipcMain.handle = (name, callback) => handlers.set(name, callback);
  class BrowserWindow extends EventEmitter {
    constructor(settings) {
      super();
      this.settings = settings;
      this.webContents = new EventEmitter();
      this.destroyed = false;
      windows.push(this);
    }
    setIgnoreMouseEvents(value) { this.ignoreMouse = value; }
    setBounds(bounds) { this.bounds = bounds; }
    getBounds() { return this.bounds; }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
    async loadFile(filename) { this.loaded = filename; }
  }
  const processStub = new EventEmitter();
  Object.assign(processStub, {
    env: { TRANSPLAYER_NONINTERACTIVE: "1", TRANSPLAYER_DESKTOP_BACKEND: "gnome49" },
    argv: ["electron", root, ...(options.argv || [])], execPath: "/synthetic/electron",
    kill() { throw new Error("Unexpected process-group kill"); },
  });
  const context = {
    require: name => {
      if (name === "electron") return {
        app, BrowserWindow, ipcMain,
        screen: { getAllDisplays: () => options.displays || [
          { bounds: { x: 0, y: 0, width: 1080, height: 1920 } },
          { bounds: { x: 1080, y: 0, width: 1080, height: 1920 } },
        ] },
        dialog: { showErrorBox() { throw new Error("Unexpected interactive dialog"); } },
        globalShortcut: {
          register: () => true,
          unregisterAll: () => { unregistered = true; },
        },
      };
      if (name === "./portable") return {
        canvasBounds,
        loadConfig: () => ({
          videoPath: "/synthetic/film.webm", startSeconds: 775,
          expectedWidth: 2160, expectedHeight: 1920,
        }),
      };
      if (name === "child_process") return {
        fork: (filename, args, settings) => {
          const child = new EventEmitter();
          Object.assign(child, {
            filename, settings, exitCode: null, signalCode: null, connected: true,
            send(message) {
              assert.equal(message.stop, true);
              this.stopRequested = true;
              this.exitCode = 0;
              this.emit("exit", 0);
            },
            kill() { throw new Error("Unexpected forced shutdown"); },
          });
          children.push(child);
          queueMicrotask(() => child.emit("message", { ready: true }));
          return child;
        },
      };
      return require(name);
    },
    __dirname: root, process: processStub,
    console: { log() {}, warn() {}, error: message => errors.push(String(message)) },
    setTimeout: callback => {
      const id = {};
      timers.set(id, callback);
      return id;
    },
    clearTimeout: id => timers.delete(id),
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "main.js"), "utf8"), context);
  return {
    app, ipcMain, handlers, windows, children, switches, exits, errors, timers,
    get hardwareDisabled() { return hardwareDisabled; },
    get unregistered() { return unregistered; },
    async ready() {
      for (const callback of app.listeners("ready")) await callback();
    },
    async stop() {
      app.emit("second-instance", {}, ["electron", "--stop"]);
      for (let i = 0; i < 12; i++) await Promise.resolve();
    },
  };
}

test("production startup leaves default GPU acceleration enabled without bypass flags", async () => {
  const f = fixture();
  await f.ready();
  assert.equal(f.windows.length, 1);
  assert.equal(f.hardwareDisabled, false, "production startup must not disable GPU acceleration");
  assert.deepEqual(f.switches, [["autoplay-policy", "no-user-gesture-required"]]);
});

test("GPU window retains transparent click-through geometry and renderer isolation", async () => {
  const f = fixture();
  await f.ready();
  const win = f.windows[0];
  for (const name of ["transparent", "alwaysOnTop", "skipTaskbar", "enableLargerThanScreen"]) {
    assert.equal(win.settings[name], true, name);
  }
  for (const name of ["focusable", "frame", "fullscreen", "resizable"]) {
    assert.equal(win.settings[name], false, name);
  }
  assert.equal(win.settings.backgroundColor, "#00000000");
  assert.equal(win.settings.webPreferences.nodeIntegration, false);
  assert.equal(win.settings.webPreferences.contextIsolation, true);
  assert.equal(win.settings.webPreferences.preload, path.join(root, "app/preload.js"));
  assert.equal(win.ignoreMouse, true);
  assert.deepEqual(JSON.parse(JSON.stringify(win.bounds)),
    { x: 0, y: 0, width: 2160, height: 1920 });
  assert.equal(win.loaded, path.join(root, "app/index.html"));
  assert.equal(f.children.length, 2);
  assert.equal(path.basename(f.children[0].filename), "sub-process.js");
  assert.equal(f.children[0].settings.detached, true);
  assert.equal(path.basename(f.children[1].filename), "desktop-modern-guard.js");
  const config = f.handlers.get("playback-config")();
  assert.equal(config.startSeconds, 775);
  assert.equal(config.videoURL, "file:///synthetic/film.webm");
});

test("GPU window still blocks hostile navigation and new-window requests", async () => {
  const f = fixture();
  await f.ready();
  for (const name of ["will-navigate", "new-window"]) {
    let prevented = false;
    f.windows[0].webContents.emit(name, { preventDefault() { prevented = true; } },
      "https://hostile.invalid/");
    assert.equal(prevented, true, name);
  }
  f.ipcMain.emit("playback-status", { sender: {} }, { error: "forged renderer error" });
  assert.equal(f.windows[0].destroyed, false);
  assert.deepEqual(f.exits, []);
});

test("display mismatch refuses GPU playback before controller or desktop mutation", async () => {
  const f = fixture({ displays: [
    { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
  ] });
  await f.ready();
  assert.equal(f.children.length, 0);
  assert.equal(f.windows.length, 0);
  assert.match(f.errors.join("\n"), /Display mismatch/);
  assert.deepEqual(f.exits, [1]);
});

test("normal GPU stop releases both owned children and exits cleanly once", async () => {
  const f = fixture();
  await f.ready();
  await f.stop();
  await f.stop();
  assert.equal(f.windows[0].destroyed, true);
  assert.equal(f.unregistered, true);
  assert.equal(f.children.every(child => child.stopRequested), true);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.exits, [0]);
});

test("standalone stop invocation creates no GPU window or owned child", async () => {
  const f = fixture({ argv: ["--stop"] });
  await f.ready();
  assert.equal(f.windows.length, 0);
  assert.equal(f.children.length, 0);
  assert.deepEqual(f.exits, [0]);
});

test("a second instance cannot start a duplicate GPU player", async () => {
  const f = fixture({ lock: false });
  await f.ready();
  assert.equal(f.windows.length, 0);
  assert.equal(f.children.length, 0);
  assert.deepEqual(f.exits, ["quit"]);
});
