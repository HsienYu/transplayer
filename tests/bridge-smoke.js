const assert = require("assert");
const { fork } = require("child_process");
const net = require("net");
const path = require("path");
const root = process.env.TRANSPLAYER_APP_ROOT;
let ready = false;
let timeout = false;
const worker = fork(path.join(root, "sub-process.js"), [], {
  execPath: process.execPath, cwd: root,
  env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
});
const timer = setTimeout(() => {
  timeout = true;
  console.error("BRIDGE_SMOKE TIMEOUT");
  worker.kill("SIGTERM");
}, 15000);
worker.on("message", message => {
  assert.equal(message.ready, true);
  ready = true;
  worker.send({ stop: true });
});
worker.on("error", error => { console.error(error); process.exitCode = 1; });
worker.on("exit", code => {
  clearTimeout(timer);
  assert(!timeout, "Bridge must stop within timeout");
  assert(ready, "Bridge must acknowledge readiness");
  assert.equal(code, 0);
  const server = net.createServer();
  server.once("error", error => { console.error(error); process.exitCode = 1; });
  server.listen(8080, "127.0.0.1", () => {
    server.close();
    console.log("BRIDGE_SMOKE PASS (ready, graceful stop, port released)");
  });
});
