// Diagnostic prototype only; never imported by the installed artwork.
const { app, BrowserWindow, screen } = require("electron");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const mode = process.env.GPU_PROBE_MODE;
if (!["software", "default-gpu"].includes(mode)) throw new Error("Invalid probe mode");
app.setPath("userData", path.join(process.env.GPU_PROBE_OUTPUT, "profile"));
if (mode === "software") app.disableHardwareAcceleration();
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
let gpuUpdated = false;
app.on("gpu-info-update", () => { gpuUpdated = true; });
const windows = [];
const properties = {};
const allowed = new Set(["kVideoDecoderName", "kIsPlatformVideoDecoder",
  "kVideoTracks", "kResolution", "kVideoDecoderType", "video_decoder"]);
let finished = false;
let lastStage = null;
const started = Date.now();
const progressFD = fs.openSync(path.join(process.env.GPU_PROBE_OUTPUT, "progress.jsonl"),
  "wx", 0o600);
function progress(stage, state = {}) {
  if (finished) return;
  const record = { stage, elapsedMs: Date.now() - started, ...state };
  fs.writeSync(progressFD, JSON.stringify(record) + "\n");
  console.log("PROBE_PROGRESS", JSON.stringify(record));
  lastStage = stage;
}
const rendererStages = new Set(["metadata-wait", "metadata-ready", "media-error",
  "seek-wait", "seek-ready", "alpha-ready", "play-wait", "playing",
  "warmup-wait", "measurement-start", "measurement-end"]);
function rendererProgress({ message }) {
  const prefix = "GPU_PROBE_STAGE ";
  if (typeof message !== "string" || !message.startsWith(prefix)) return;
  let record;
  try {
    if (message.length > 2048) throw new Error("Oversized stage record");
    record = JSON.parse(message.slice(prefix.length));
    if (!record || !rendererStages.has(record.stage)) throw new Error("Invalid stage");
  } catch (error) {
    progress("renderer-progress-invalid");
    return;
  }
  // Never persist arbitrary console text, media URLs or sourceId/frame details.
  const state = {};
  for (const key of ["currentTime", "readyState", "networkState", "errorCode"])
    if (typeof record[key] === "number" && Number.isFinite(record[key]))
      state[key] = record[key];
  for (const key of ["paused", "seeking"])
    if (typeof record[key] === "boolean") state[key] = record[key];
  progress(record.stage, state);
}
function finish(code) {
  if (finished) return;
  finished = true;
  for (const win of windows) if (!win.isDestroyed()) win.destroy();
  fs.closeSync(progressFD);
  app.exit(code);
}
const watchdog = setTimeout(() => {
  progress("watchdog", { waitingFor: lastStage });
  console.error("PROBE_FAILURE watchdog expired");
  finish(1);
}, 55000);
process.on("SIGTERM", () => finish(1));
process.on("SIGINT", () => finish(1));
progress("app-ready-wait");
app.whenReady().then(async () => {
  try {
    progress("app-ready");
    const displays = screen.getAllDisplays().map(d => d.bounds);
    const left = Math.min(...displays.map(d => d.x));
    const top = Math.min(...displays.map(d => d.y));
    const width = Math.max(...displays.map(d => d.x + d.width)) - left;
    const height = Math.max(...displays.map(d => d.y + d.height)) - top;
    if (displays.length !== 2 || width !== 2160 || height !== 1920)
      throw new Error("Display geometry mismatch");
    const geometry = { x: left, y: top, width, height, frame: false,
      resizable: false, enableLargerThanScreen: true };
    const background = new BrowserWindow({ ...geometry,
      webPreferences: { nodeIntegration: false, contextIsolation: true } });
    windows.push(background);
    const label = mode === "software" ? "A — software baseline" : "B — default GPU";
    const html = `<html><body style="margin:0;height:100vh;background:repeating-conic-gradient(#ddd 0% 25%,#888 0% 50%) 0/80px 80px"><div style="background:white;color:black;font:36px sans-serif;padding:20px">${label} — transparent VP9 diagnostic, muted</div></body></html>`;
    progress("background-load");
    await background.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    progress("background-ready");
    const overlay = new BrowserWindow({ ...geometry, title: "Transplayer GPU probe",
      focusable: false, transparent: true, backgroundColor: "#00000000",
      alwaysOnTop: true, skipTaskbar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true,
        backgroundThrottling: false } });
    windows.push(overlay);
    // Event properties are supported since Electron35, including the pinned45.
    overlay.webContents.on("console-message", rendererProgress);
    overlay.webContents.on("render-process-gone", (event, details) => {
      progress("renderer-gone", { exitCode: details.exitCode });
    });
    overlay.setIgnoreMouseEvents(true);
    overlay.setBounds(geometry);
    // Electron45.1.0 debugger docs: commands can await the first navigation.
    // The page has no media source until runProbe below, so Media stays enabled first.
    progress("overlay-load");
    await overlay.loadFile(path.join(__dirname, "probe.html"));
    progress("overlay-ready");
    overlay.webContents.debugger.attach("1.3");
    overlay.webContents.debugger.on("message", (event, method, params) => {
      if (method === "Media.playerPropertiesChanged") {
        for (const entry of params.properties || [])
          if (allowed.has(entry.name)) properties[entry.name] = entry.value;
      }
    });
    progress("media-enable");
    await overlay.webContents.debugger.sendCommand("Media.enable");
    progress("renderer-invoke");
    const result = await overlay.webContents.executeJavaScript(
      `window.runProbe(${JSON.stringify(pathToFileURL(process.env.TRANSPLAYER_VIDEO).href)})`);
    progress("renderer-result");
    const output = { mode, electron: process.versions.electron, gpuUpdated,
      gpuFeatures: gpuUpdated ? app.getGPUFeatureStatus() : null, properties,
      overlayBounds: overlay.getBounds(), ...result };
    fs.writeFileSync(path.join(process.env.GPU_PROBE_OUTPUT, "result.json"),
      JSON.stringify(output, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log("PROBE_RESULT", JSON.stringify(output));
    if (result.frames <= 0 || result.mediaSeconds < 20 ||
        result.initialAlpha.transparent + result.initialAlpha.partial <= 0 ||
        result.initialAlpha.opaque <= 0) throw new Error("Probe progress or alpha acceptance failed");
    clearTimeout(watchdog);
    progress("complete");
    finish(0);
  } catch (error) {
    progress("failure", { waitingFor: lastStage });
    console.error(error.stack);
    clearTimeout(watchdog);
    finish(1);
  }
}).catch(error => {
  progress("failure", { waitingFor: lastStage });
  console.error(error.stack);
  finish(1);
});
