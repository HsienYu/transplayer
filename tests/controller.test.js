const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function controllerClass(overrides = {}) {
  const sandbox = {
    module: { exports: {} }, console, Buffer, setTimeout, process: overrides.process || process,
    __dirname: path.resolve(__dirname, ".."),
    require(name) {
      if (overrides.modules && name in overrides.modules) return overrides.modules[name];
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

function chromeFirstFixture({ startupFailure = false, closeFailure = false } = {}) {
  const recorded = { options: [], starts: 0, closes: 0, reads: 0 };
  const driver = { manage: () => ({ setTimeouts: async value => { recorded.timeouts = value; } }) };
  class ChromeSession {
    constructor(options) {
      recorded.options.push(options);
      this.driver = driver;
      this.child = { exitCode: null, signalCode: null };
    }
    async start() { recorded.starts++; if (startupFailure) throw Error("synthetic attach failure"); return this; }
    async close() { recorded.closes++; if (closeFailure) throw Error("synthetic session close failure"); }
  }
  const Controller = controllerClass({
    process: { env: { TRANSPLAYER_BROWSER_BACKEND: "chrome-first",
      TRANSPLAYER_CHROME: "/synthetic/chrome", TRANSPLAYER_DRIVER: "/synthetic/driver",
      TRANSPLAYER_PROFILE_DIR: "/synthetic/profiles-r9" } },
    modules: { "./chrome-session": { ChromeSession },
      fs: { readFileSync() { recorded.reads++; throw Error("No extension reads permitted"); } } },
  });
  return { controller: new Controller(), recorded, driver };
}

test("chrome-first backend connects its session without legacy options or solver reads", async () => {
  const f = chromeFirstFixture();
  assert.equal(await f.controller.getWebDriver(13), f.driver);
  assert.equal(f.recorded.starts, 1);
  assert.equal(f.recorded.reads, 0);
  assert.equal(f.recorded.options[0].profileDir, "/synthetic/profiles-r9/se_13");
  assert.equal(f.recorded.options[0].chromePath, "/synthetic/chrome");
  assert.equal(f.recorded.options[0].driverPath, "/synthetic/driver");
  await f.controller.getWebDriver(13);
  assert.equal(f.recorded.starts, 1);
  assert.equal(await f.controller.closeBrowser(13), true);
  assert.equal(f.recorded.closes, 1);
});

test("chrome-first replaces a cached driver whose owned browser has exited", async () => {
  const f = chromeFirstFixture();
  await f.controller.getWebDriver(13);
  f.controller.browsers[13].session.child.exitCode = 1;
  assert.equal(await f.controller.getWebDriver(13), f.driver);
  assert.equal(f.recorded.closes, 1);
  assert.equal(f.recorded.starts, 2);
});

test("a failed cleanup never starts another Chrome in the same attempt", async () => {
  const f = chromeFirstFixture({ closeFailure: true });
  await f.controller.getWebDriver(13);
  f.controller.browsers[13].session.child.exitCode = 1;
  assert.equal(await f.controller.getWebDriver(13), null);
  assert.equal(f.recorded.closes, 1);
  assert.equal(f.recorded.starts, 1);
});
test("failed chrome-first creation cleans the session and allows an explicit retry", async () => {
  const f = chromeFirstFixture({ startupFailure: true });
  await assert.rejects(f.controller.getWebDriver(13), /attach failure/);
  assert.equal(f.recorded.closes, 1);
  assert.equal(f.controller.browsers[13], null);
  assert.equal(f.controller.isCreating, false);
});

test("chrome-first close failure remains visible but clears its controller entry", async () => {
  const f = chromeFirstFixture({ closeFailure: true });
  await f.controller.getWebDriver(13);
  assert.equal(await f.controller.closeBrowser(13), false);
  assert.equal(f.recorded.closes, 1);
  assert.equal(f.controller.browsers[13], null);
});

test("unknown browser backend is rejected rather than silently using legacy", async () => {
  const Controller = controllerClass({ process: { env: { TRANSPLAYER_BROWSER_BACKEND: "forged" } } });
  await assert.rejects(new Controller().getWebDriver(13), /backend/i);
});

test("GNOME49 browser uses Xwayland for deterministic placement without disabling sandbox", async () => {
  const modern = await recordedBrowserOptions({ TRANSPLAYER_DESKTOP_BACKEND: "gnome49" });
  assert(modern.args.includes("--ozone-platform=x11"));
  assert(!modern.args.includes("--no-sandbox"));
  assert(!modern.args.includes("--disable-gpu-sandbox"));
  const legacy = await recordedBrowserOptions({});
  assert(!legacy.args.includes("--ozone-platform=x11"));
});

async function recordedBrowserOptions(env = {}) {
  const recorded = { extensions: [], reads: [], args: [] };
  class Options {
    setChromeBinaryPath(value) { recorded.binary = value; }
    addArguments(value) { recorded.args = value; }
    addExtensions(value) { recorded.extensions.push(value); }
    excludeSwitches() {}
  }
  class Builder {
    forBrowser() { return this; }
    setChromeService() { return this; }
    setChromeOptions() { return this; }
    async build() { return { manage: () => ({ setTimeouts: async () => {} }) }; }
  }
  const Controller = controllerClass({
    process: { env },
    modules: {
      "selenium-webdriver": { Builder },
      "selenium-webdriver/chrome": { ServiceBuilder: class {}, Options },
      fs: { readFileSync(file) { recorded.reads.push(file); return Buffer.from("synthetic extension"); } },
    },
  });
  await new Controller().getWebDriver(13);
  return recorded;
}

test("modern browser loads only the packaged Manifest V3 solver, not legacy uBlock", async () => {
  const options = await recordedBrowserOptions({ TRANSPLAYER_CHROME: "/synthetic/chrome" });
  assert.equal(options.binary, "/synthetic/chrome");
  assert.equal(options.extensions.length, 1);
  assert.equal(path.basename(options.reads[0]), "nopecha-0.6.1.zip");
  assert(options.args.some(arg => arg.includes("/profiles-r7/")));
  assert(!options.args.includes("--no-sandbox"));
});

test("operator can disable the CAPTCHA extension without reading its archive", async () => {
  const options = await recordedBrowserOptions({ TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION: "1" });
  assert.deepEqual(options.extensions, []);
  assert.deepEqual(options.reads, []);
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
