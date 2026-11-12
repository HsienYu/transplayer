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

function goToFixture(currentUrls) {
  const Controller = controllerClass();
  const controller = new Controller();
  controller.SORRY_RETRY_MS = 0; // keep the test fast; production waits a few seconds
  const calls = { get: [], current: 0 };
  const settled = "https://www.google.com/search?q=x&udm=2#ip=1";
  const driver = {
    async get(url) { calls.get.push(url); },
    async getCurrentUrl() { return currentUrls[calls.current++] ?? settled; },
  };
  controller.getWebDriver = async () => driver;
  return { controller, calls, driver };
}

const REQUEST_URL = "https://www.google.com/search?q=x&tbm=isch";
const SORRY_URL = "https://www.google.com/sorry/index?continue=https://www.google.com/search";

test("goTo retries once when Google serves a /sorry/ abuse page", async () => {
  const f = goToFixture([SORRY_URL, "https://www.google.com/search?q=x&udm=2#ip=1"]);
  assert.equal(await f.controller.goTo(14, REQUEST_URL), true);
  assert.deepEqual(f.calls.get, [REQUEST_URL, REQUEST_URL]);
});

test("goTo does not retry when the first navigation lands on a real result", async () => {
  const f = goToFixture(["https://www.google.com/search?q=x&udm=2#ip=1"]);
  assert.equal(await f.controller.goTo(14, REQUEST_URL), true);
  assert.deepEqual(f.calls.get, [REQUEST_URL]);
});

test("goTo retries at most once even when the retry also lands on /sorry/", async () => {
  const f = goToFixture([SORRY_URL, SORRY_URL]);
  assert.equal(await f.controller.goTo(14, REQUEST_URL), true);
  assert.equal(f.calls.get.length, 2);
});

const os = require("node:os");
const fsReal = require("node:fs");

function snapFixture(currentUrls = [], profileDir) {
  const dir = profileDir || fsReal.mkdtempSync(path.join(os.tmpdir(), "tp-snap-"));
  const Controller = controllerClass({ process: { env: { TRANSPLAYER_PROFILE_DIR: dir } } });
  const controller = new Controller();
  controller.SORRY_RETRY_MS = 0;
  const calls = { get: [] };
  let idx = 0;
  const driver = {
    async get(u) { calls.get.push(u); },
    async getCurrentUrl() { return currentUrls[idx++] ?? "https://www.google.com/search?q=x&udm=2#ip=1"; },
  };
  controller.getWebDriver = async () => driver;
  return { controller, driver, calls, dir };
}

// A driver that answers the two capture-gate scripts: GATE_CHECK_JS -> `gated` (boolean),
// CLEAN_CHECK_JS (contains img[src) -> `count` image thumbnails. `error` throws (fail-closed).
function captureDriver({ count = 500, gated = false, error = false } = {}) {
  return {
    async getCurrentUrl() { return "https://www.google.com/search?q=x&udm=2#ip=1"; },
    async executeScript(script) {
      if (error) throw new Error("page gone");
      if (String(script).includes("img[src")) return count;
      return gated;
    },
  };
}

test("snapshotPath maps a query URL to a stable file under the profile snapshots dir", () => {
  const f = snapFixture();
  const q = "https://www.google.com/search?q=elephant&tbm=isch";
  assert.equal(f.controller.snapshotPath(q), f.controller.snapshotPath(q));
  assert(f.controller.snapshotPath(q).startsWith(path.join(f.dir, "snapshots") + path.sep));
  assert(f.controller.snapshotPath(q).endsWith(".mhtml"));
  assert.notEqual(f.controller.snapshotPath(q),
    f.controller.snapshotPath("https://www.google.com/search?q=other&tbm=isch"));
});

test("goTo serves a cached same-day snapshot instead of showing /sorry/ (no retry)", async () => {
  const f = snapFixture(["https://www.google.com/sorry/index?x"]);
  const url = "https://www.google.com/search?q=x&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  assert.equal(await f.controller.goTo(14, url), true);
  assert.deepEqual(f.calls.get, [url, "file://" + snap]);
});

test("goTo falls back to the rc4 retry when /sorry/ and no snapshot exists", async () => {
  const f = snapFixture(["https://www.google.com/sorry/index?x",
    "https://www.google.com/search?q=x&udm=2#ip=1"]);
  const url = "https://www.google.com/search?q=x&tbm=isch";
  assert.equal(await f.controller.goTo(14, url), true);
  assert.deepEqual(f.calls.get, [url, url]); // retried same url, did not serve a file://
});

test("maybeCapture refreshes a clean page at most once per run", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=cap&tbm=isch";
  let captures = 0;
  f.controller.browsers[15] = { captureUrl: url, driver: captureDriver(),
    session: { captureSnapshot: async () => { captures++; return "M".repeat(200000); } } };
  await f.controller.maybeCapture(15);
  assert.equal(captures, 1);
  assert(fsReal.existsSync(f.controller.snapshotPath(url)));
  f.controller.browsers[15].captureUrl = url; // ask again this run
  await f.controller.maybeCapture(15);
  assert.equal(captures, 1); // already refreshed this run -> no second capture
});

test("maybeCapture overwrites a persisted snapshot on the run's first clean sighting (refresh)", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=stale&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "OLD".repeat(40000)); // a persisted snapshot from a prior run
  f.controller.browsers[15] = { captureUrl: url, driver: captureDriver(),
    session: { captureSnapshot: async () => "NEW".repeat(80000) } };
  await f.controller.maybeCapture(15);
  assert.match(fsReal.readFileSync(snap, "utf8"), /^NEW/); // refreshed, not first-clean-wins
});

test("maybeCapture retries once when the first capture fails transiently", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=flaky&tbm=isch";
  let attempts = 0;
  f.controller.browsers[15] = { captureUrl: url, driver: captureDriver(),
    session: { captureSnapshot: async () => {
      attempts++;
      if (attempts === 1) throw new Error("transport failed");
      return "M".repeat(200000);
    } } };
  await f.controller.maybeCapture(15);
  assert.equal(attempts, 2);
  assert(fsReal.existsSync(f.controller.snapshotPath(url)));
});

test("maybeCapture does not capture a gated page", async () => {
  const f = snapFixture();
  let captures = 0;
  f.controller.browsers[16] = { captureUrl: null,
    session: { captureSnapshot: async () => { captures++; return "x".repeat(200000); } } };
  await f.controller.maybeCapture(16);
  assert.equal(captures, 0);
});

test("maybeCapture refuses a grey / near-empty page (positive image-results gate)", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=grey&tbm=isch";
  let captures = 0;
  f.controller.browsers[15] = { captureUrl: url, driver: captureDriver({ count: 3 }),
    session: { captureSnapshot: async () => { captures++; return "M".repeat(200000); } } };
  await f.controller.maybeCapture(15);
  assert.equal(captures, 0); // too few image results -> not a real results page -> never cached
  assert(!fsReal.existsSync(f.controller.snapshotPath(url)));
});

test("maybeCapture fails closed when the clean-results check errors", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=err&tbm=isch";
  let captures = 0;
  f.controller.browsers[15] = { captureUrl: url, driver: captureDriver({ error: true }),
    session: { captureSnapshot: async () => { captures++; return "M".repeat(200000); } } };
  await f.controller.maybeCapture(15);
  assert.equal(captures, 0); // detection errored -> treat as not-clean -> do not cache
});

test("resetDisplayProfiles clears se_* display profiles each run but keeps the snapshot cache", () => {
  const f = snapFixture();
  const se13 = path.join(f.dir, "se_13"), se19 = path.join(f.dir, "se_19");
  fsReal.mkdirSync(se13, { recursive: true });
  fsReal.writeFileSync(path.join(se13, "Cookies"), "flagged");
  fsReal.mkdirSync(se19, { recursive: true });
  const keep = path.join(f.dir, "snapshots", "keep.mhtml");
  fsReal.mkdirSync(path.dirname(keep), { recursive: true });
  fsReal.writeFileSync(keep, "M".repeat(200000));
  f.controller.resetDisplayProfiles();
  assert(!fsReal.existsSync(se13));
  assert(!fsReal.existsSync(se19));
  assert(fsReal.existsSync(keep)); // persisted snapshot cache survives a fresh-profile run
});

test("goTo serves cache when the page shows an inline reCAPTCHA (content-gated, not /sorry/)", async () => {
  const dir = fsReal.mkdtempSync(path.join(os.tmpdir(), "tp-snap-"));
  const Controller = controllerClass({ process: { env: { TRANSPLAYER_PROFILE_DIR: dir } } });
  const controller = new Controller();
  controller.SORRY_RETRY_MS = 0;
  const url = "https://www.google.com/search?q=starlink&tbm=isch";
  const snap = controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  const calls = { get: [] };
  const driver = {
    async get(u) { calls.get.push(u); },
    async getCurrentUrl() { return "https://www.google.com/search?q=starlink&udm=2#ip=1"; }, // not /sorry/
    async executeScript() { return true; }, // page body is an "unusual traffic" reCAPTCHA
  };
  controller.getWebDriver = async () => driver;
  assert.equal(await controller.goTo(14, url), true);
  assert.deepEqual(calls.get, [url, "file://" + snap]); // served cache despite the /search URL
});

test("maybeCapture refuses to cache a content-gated (inline reCAPTCHA) page", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=starlink&tbm=isch";
  let captures = 0;
  f.controller.browsers[15] = { captureUrl: url,
    driver: { async getCurrentUrl() { return "https://www.google.com/search?q=starlink&udm=2"; },
      async executeScript() { return true; } },
    session: { captureSnapshot: async () => { captures++; return "M".repeat(200000); } } };
  await f.controller.maybeCapture(15);
  assert.equal(captures, 0); // gated page -> never cached
  assert(!fsReal.existsSync(f.controller.snapshotPath(url)));
});

test("constructing the controller persists existing snapshots across reboots", () => {
  const dir = fsReal.mkdtempSync(path.join(os.tmpdir(), "tp-snap-"));
  const snaps = path.join(dir, "snapshots");
  fsReal.mkdirSync(snaps, { recursive: true });
  fsReal.writeFileSync(path.join(snaps, "kept.mhtml"), "prior-run");
  const Controller = controllerClass({ process: { env: { TRANSPLAYER_PROFILE_DIR: dir } } });
  new Controller();
  assert(fsReal.existsSync(path.join(snaps, "kept.mhtml"))); // survives a reboot
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
