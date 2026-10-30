const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function controllerClass() {
  const sandbox = {
    module: { exports: {} }, console, Buffer, setTimeout, process,
    __dirname: path.resolve(__dirname, ".."),
    require(name) {
      if (name === "selenium-webdriver") return {};
      if (name === "selenium-webdriver/chrome") {
        return { ServiceBuilder: class {}, Options: class {} };
      }
      return require(name);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../controller.js"), "utf8"), sandbox);
  return sandbox.module.exports;
}

test("closing a browser awaits quit, releasing its driver session", async () => {
  const Controller = controllerClass();
  const controller = new Controller();
  let quit = false;
  controller.browsers[1] = { scrollState: 0, driver: {
    close() {},
    async quit() { await new Promise(resolve => setTimeout(resolve, 5)); quit = true; },
  } };
  assert.equal(await controller.closeBrowser(1), true);
  assert.equal(quit, true);
  assert.equal(controller.browsers[1], null);
});

test("closeAllBrowser awaits every owned session and handles null entries", async () => {
  const Controller = controllerClass();
  const controller = new Controller();
  let completed = 0;
  for (const id of [1, 2]) {
    controller.browsers[id] = { driver: {
      close() {},
      async quit() { await new Promise(resolve => setTimeout(resolve, 5)); completed++; },
    } };
  }
  controller.browsers[3] = null;
  await controller.closeAllBrowser();
  assert.equal(completed, 2);
});

test("failed quit reports failure while clearing the browser reference", async () => {
  const Controller = controllerClass();
  const controller = new Controller();
  controller.browsers[1] = { driver: { async quit() { throw new Error("synthetic quit failure"); } } };
  assert.equal(await controller.closeBrowser(1), false);
  assert.equal(controller.browsers[1], null);
});

test("every controller operation used by the live timeline remains available", () => {
  const Controller = controllerClass();
  const timeline = fs.readFileSync(path.join(__dirname, "../web-process-new.js"), "utf8");
  const calls = [...timeline.matchAll(/controller\.(\w+)\(/g)].map(match => match[1]);
  assert(calls.length > 0);
  for (const name of new Set(calls)) {
    assert.equal(typeof Controller.prototype[name], "function", name);
  }
});
