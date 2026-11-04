const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");

test("GPU probe shutdown settling is bounded, observable and fails closed", () => {
  const result = spawnSync("python3", [path.join(__dirname, "gpu_probe_cases.py")],
    { encoding: "utf8", timeout: 20000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

const probeRoot = path.join(__dirname, "../experiments/gpu-playback");
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

function rendererFixture() {
  const messages = [];
  let ticks = 0;
  const video = {
    videoWidth: 2160, videoHeight: 1920, currentTime: 0,
    readyState: 0, networkState: 0, paused: true, seeking: false,
    requestVideoFrameCallback() {},
    play: async () => { video.paused = false; },
    pause() { video.paused = true; },
    getVideoPlaybackQuality() {
      ticks++;
      video.currentTime += 30;
      return { totalVideoFrames: ticks * 750, droppedVideoFrames: ticks * 10 };
    },
  };
  const context = {
    window: {}, console: { log: message => messages.push(message) },
    document: {
      getElementById: () => video,
      createElement: () => ({
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 255]) }),
        }),
      }),
    },
    performance: { now: () => ticks * 30000 },
    setTimeout: callback => { callback(); return 1; },
    setInterval: () => 1, clearInterval() {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(probeRoot, "renderer.js"), "utf8"), context);
  const records = () => messages.map(message =>
    JSON.parse(message.slice("GPU_PROBE_STAGE ".length)));
  return { video, run: context.window.runProbe, records, messages };
}

test("GPU renderer identifies a metadata wait without logging the media URL", async () => {
  const f = rendererFixture();
  f.run("file:///synthetic/private-video?do-not-log");
  await flush();
  assert.equal(f.records().at(-1).stage, "metadata-wait");
  assert.equal(f.messages.join("").includes("private-video"), false);
});

test("GPU renderer distinguishes a stalled seek from metadata loading", async () => {
  const f = rendererFixture();
  f.run("file:///synthetic/video");
  f.video.onloadedmetadata();
  await flush();
  assert.equal(f.records().at(-1).stage, "seek-wait");
  assert.equal(f.video.currentTime, 150);
});

test("GPU renderer reports play rejection at the correct phase", async () => {
  const f = rendererFixture();
  f.video.play = async () => { throw new Error("Synthetic play refusal"); };
  const result = f.run("file:///synthetic/video");
  f.video.onloadedmetadata();
  await flush();
  f.video.onseeked();
  await assert.rejects(result, /Synthetic play refusal/);
  assert.equal(f.records().at(-1).stage, "play-wait");
});

test("GPU renderer records the complete measurement phase sequence", async () => {
  const f = rendererFixture();
  const result = f.run("file:///synthetic/video");
  f.video.onloadedmetadata();
  await flush();
  f.video.onseeked();
  const measured = await result;
  assert.deepEqual(f.records().map(record => record.stage), [
    "metadata-wait", "metadata-ready", "seek-wait", "seek-ready",
    "alpha-ready", "play-wait", "playing", "warmup-wait",
    "measurement-start", "measurement-end",
  ]);
  assert.equal(measured.frames, 750);
  assert.equal(f.video.paused, true);
});

function mainFixture(options = {}) {
  const records = [], listeners = {}, timers = [], windows = [], exits = [];
  const lifecycle = [];
  const electron = {
    app: {
      setPath() {}, disableHardwareAcceleration() {},
      commandLine: { appendSwitch() {} }, on() {},
      whenReady: () => Promise.resolve(), exit: code => exits.push(code),
    },
    screen: { getAllDisplays: () => [
      { bounds: { x: 0, y: 0, width: 1080, height: 1920 } },
      { bounds: { x: 1080, y: 0, width: 1080, height: 1920 } },
    ] },
    BrowserWindow: class {
      constructor() {
        windows.push(this);
        this.navigated = false;
        this.mediaEnabled = false;
        this.webContents = {
          on: (name, callback) => { listeners[name] = callback; },
          debugger: {
            attach() { lifecycle.push("attach"); },
            on() {},
            sendCommand: async method => {
              lifecycle.push(method);
              // Electron45 buffers debugger replies until the target navigates.
              if (!this.navigated) await new Promise(() => {});
              if (options.mediaError) throw options.mediaError;
              this.mediaEnabled = true;
            },
          },
          executeJavaScript: () => {
            assert.equal(this.mediaEnabled, true);
            lifecycle.push("invoke");
            return new Promise(() => {});
          },
        };
      }
      loadURL() { return new Promise(() => {}); }
      loadFile() {
        lifecycle.push("load");
        this.navigated = true;
        return Promise.resolve();
      }
      setIgnoreMouseEvents() {}
      setBounds() {}
      isDestroyed() { return false; }
      destroy() {}
    },
  };
  const context = {
    require: name => {
      if (name === "electron") return electron;
      if (name === "fs") return {
        openSync: (filename, flags, mode) => {
          assert.equal(path.basename(filename), "progress.jsonl");
          assert.equal(flags, "wx");
          assert.equal(mode, 0o600);
          return 123;
        },
        writeSync: (fd, data) => { records.push(JSON.parse(data)); },
        closeSync() {},
      };
      return require(name);
    },
    __dirname: probeRoot,
    process: {
      env: { GPU_PROBE_MODE: "software", GPU_PROBE_OUTPUT: "/synthetic/output",
        TRANSPLAYER_VIDEO: "/synthetic/private-video" },
      on() {},
    },
    console: { log() {}, error() {} },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return 1; },
    clearTimeout() {},
  };
  return {
    records, timers, windows, exits, listeners, electron, lifecycle,
    start() { vm.runInNewContext(fs.readFileSync(path.join(probeRoot, "probe.js"), "utf8"), context); },
  };
}

test("GPU watchdog retains the pending main phase without extending its deadline", async () => {
  const f = mainFixture();
  f.start();
  await flush();
  assert.equal(f.records.at(-1).stage, "background-load");
  assert.equal(f.timers[0].delay, 55000);
  f.timers[0].callback();
  assert.equal(f.records.at(-1).stage, "watchdog");
  assert.equal(f.records.at(-1).waitingFor, "background-load");
  assert.deepEqual(f.exits, [1]);
});

test("GPU main phase relay accepts only known stages and safe numeric state", async () => {
  const f = mainFixture();
  f.electron.BrowserWindow.prototype.loadURL = () => Promise.resolve();
  f.start();
  await flush();
  const relay = f.listeners["console-message"];
  assert.equal(typeof relay, "function");
  relay({ message: 'GPU_PROBE_STAGE {"stage":"seek-wait","currentTime":150,"url":"private-data","readyState":1}' });
  assert.equal(f.records.at(-1).stage, "seek-wait");
  assert.equal(f.records.at(-1).currentTime, 150);
  relay({ message: 'GPU_PROBE_STAGE {"stage":"untrusted-private-data","currentTime":"private-data"}' });
  relay({ message: 'GPU_PROBE_STAGE invalid-private-data' });
  assert.equal(JSON.stringify(f.records).includes("private-data"), false);
  f.timers[0].callback();
});

test("GPU probe navigates before debugger commands and enables Media before playback", async () => {
  const f = mainFixture();
  f.electron.BrowserWindow.prototype.loadURL = () => Promise.resolve();
  f.start();
  await flush();
  assert.deepEqual(f.lifecycle, ["load", "attach", "Media.enable", "invoke"]);
  assert.equal(f.records.at(-1).stage, "renderer-invoke");
  f.timers[0].callback();
});

test("GPU probe navigation failure exits without attaching or enabling Media", async () => {
  const f = mainFixture();
  f.electron.BrowserWindow.prototype.loadURL = () => Promise.resolve();
  f.electron.BrowserWindow.prototype.loadFile = () => {
    f.lifecycle.push("load");
    return Promise.reject(new Error("Synthetic navigation failure"));
  };
  f.start();
  await flush();
  assert.deepEqual(f.lifecycle, ["load"]);
  assert.deepEqual(f.exits, [1]);
  assert.equal(f.records.at(-1).waitingFor, "overlay-load");
});

test("GPU probe Media enable failure never invokes the renderer", async () => {
  const f = mainFixture({ mediaError: new Error("Synthetic Media refusal") });
  f.electron.BrowserWindow.prototype.loadURL = () => Promise.resolve();
  f.start();
  await flush();
  assert.deepEqual(f.lifecycle, ["load", "attach", "Media.enable"]);
  assert.deepEqual(f.exits, [1]);
  assert.equal(f.records.at(-1).waitingFor, "media-enable");
});
