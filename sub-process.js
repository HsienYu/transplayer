const OSC = require("osc-js");
const { fork } = require("child_process");
const path = require("path");
const { timecode } = require("./portable");

const osc = new OSC({ plugin: new OSC.WebsocketServerPlugin() });
let previousTime;
let stopping = false;
const webProcess = fork(path.join(__dirname, "web-process-new.js"), [], {
  cwd: __dirname, execPath: process.execPath,
  env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
});

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  osc.close();
  if (webProcess.exitCode !== null || webProcess.signalCode !== null) process.exit(code);
  webProcess.once("exit", () => process.exit(code));
  if (webProcess.connected) webProcess.send({ stop: true });
  else webProcess.kill("SIGTERM");
}
webProcess.on("error", error => { console.error(error); stop(1); });
webProcess.on("exit", code => { if (!stopping) stop(code || 1); });
webProcess.on("message", message => {
  if (message.ready) osc.open({ host: "127.0.0.1", port: 8080 });
});
osc.on("open", () => { if (process.send) process.send({ ready: true }); });
osc.on("error", error => { console.error("OSC server error", error); stop(1); });
osc.on("/test/random", message => {
  const currentTime = timecode(message.args);
  if (stopping || currentTime === null || currentTime === previousTime) return;
  previousTime = currentTime;
  if (webProcess.connected) webProcess.send({ currentTime });
});
process.on("message", message => { if (message.stop) stop(); });
process.on("disconnect", () => stop());
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
