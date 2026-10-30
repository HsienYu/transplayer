const { spawn } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const child = spawn("/usr/bin/gjs", [
  path.join(__dirname, "desktop-client.js"), String(process.ppid),
  crypto.randomBytes(16).toString("hex"),
], { stdio: ["pipe", "pipe", "inherit"] });
let ready = false;
let stopping = false;
let timer;
let output = "";
child.stdout.on("data", data => {
  process.stdout.write(data);
  output += data.toString();
  if (!ready && output.includes("DESKTOP_HIDDEN\n")) {
    ready = true;
    if (process.connected) process.send({ ready: true });
    else stop();
  }
});
child.once("error", error => { console.error(error.stack); process.exit(1); });
child.once("exit", (code, signal) => {
  clearTimeout(timer);
  process.exit(code === 0 && stopping && !signal ? 0 : 1);
});
function stop() {
  if (stopping) return;
  stopping = true;
  child.stdin.end("stop\n");
  timer = setTimeout(() => child.kill("SIGTERM"), 6000);
}
child.stdin.on("error", error => {
  if (error.code !== "EPIPE") console.error(error.stack);
});
process.on("message", message => { if (message.stop) stop(); });
process.on("disconnect", stop);
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
