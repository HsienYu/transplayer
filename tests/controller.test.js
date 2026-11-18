const acceptedMhtml = 'MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary=x\r\n\r\n--x\r\nContent-Type: text/html\r\n\r\n<body>' + 'M'.repeat(200000) + '</body>\r\n--x--\r\n';
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
      if (name === "./seeder") return require("../seeder");
      if (name === "./queries") return require("../queries");
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

// --- rc14: slow seed waits for images to actually load before capturing ---

// A driver whose LOADED_CHECK_JS (contains "naturalWidth") returns successive values from `seq`,
// holding the last value once exhausted. Any other script returns 0.
function loadedDriver(seq) {
  let i = 0;
  const calls = { n: 0 };
  const driver = {
    async executeScript(script) {
      if (String(script).includes("naturalWidth")) {
        calls.n++;
        const v = i < seq.length ? seq[i] : seq[seq.length - 1];
        i++;
        return v;
      }
      return 0;
    },
  };
  return { driver, calls };
}

test("countLoadedImages returns the page count and -1 on a page error", async () => {
  const f = snapFixture();
  const { driver } = loadedDriver([42]);
  assert.equal(await f.controller.countLoadedImages(driver), 42);
  const bad = { async executeScript() { throw new Error("page gone"); } };
  assert.equal(await f.controller.countLoadedImages(bad), -1);
});

test("waitImagesSettled returns the settled max once growth stops, without waiting out the timeout", async () => {
  const f = snapFixture();
  const { driver, calls } = loadedDriver([10, 40, 90, 120, 120, 120, 120, 120, 120]);
  const loaded = await f.controller.waitImagesSettled(driver,
    { timeoutMs: 2000, stableMs: 45, pollMs: 10 });
  assert.equal(loaded, 120);          // the high-water mark, not an early partial count
  assert(calls.n < 40, `stopped early, polled ${calls.n} times`); // settled, did not run to timeout
});

test("waitImagesSettled returns 0 when the page never reports loaded images", async () => {
  const f = snapFixture();
  const bad = { async executeScript() { throw new Error("page gone"); } };
  const loaded = await f.controller.waitImagesSettled(bad,
    { timeoutMs: 60, stableMs: 20, pollMs: 10 });
  assert.equal(loaded, 0);
});

test("writeSnapshotIfRicher writes a fresh snapshot and records the loaded count", () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=fresh&tbm=isch";
  assert.equal(f.controller.writeSnapshotIfRicher(url, "M".repeat(200000), 217), "written");
  assert(fsReal.existsSync(f.controller.snapshotPath(url)));
  assert.equal(fsReal.readFileSync(f.controller.snapshotPath(url) + ".n", "utf8"), "217");
});

test("writeSnapshotIfRicher keeps a richer existing snapshot instead of downgrading to a sparse one", () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=keep&tbm=isch";
  f.controller.writeSnapshotIfRicher(url, "RICH".repeat(60000), 300);
  const before = fsReal.readFileSync(f.controller.snapshotPath(url), "utf8");
  // 100 < 300 * 0.7 (=210) -> keep the richer one
  assert.equal(f.controller.writeSnapshotIfRicher(url, "POOR".repeat(60000), 100), "kept");
  assert.equal(fsReal.readFileSync(f.controller.snapshotPath(url), "utf8"), before); // unchanged
  assert.equal(fsReal.readFileSync(f.controller.snapshotPath(url) + ".n", "utf8"), "300");
});

test("writeSnapshotIfRicher replaces when the new capture is at least as rich", () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=better&tbm=isch";
  f.controller.writeSnapshotIfRicher(url, "OLD".repeat(40000), 100);
  assert.equal(f.controller.writeSnapshotIfRicher(url, "NEW".repeat(80000), 260), "written");
  assert.match(fsReal.readFileSync(f.controller.snapshotPath(url), "utf8"), /^NEW/);
  assert.equal(fsReal.readFileSync(f.controller.snapshotPath(url) + ".n", "utf8"), "260");
});

test("writeSnapshotIfRicher rejects a capture too small to be a real page", () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=tiny&tbm=isch";
  assert.equal(f.controller.writeSnapshotIfRicher(url, "x".repeat(1000), 217), "rejected");
  assert(!fsReal.existsSync(f.controller.snapshotPath(url)));
});

test("writeSnapshotIfRicher refreshes a richer-but-OLD snapshot (freshness beats richness after a day)", () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=stale-rich&tbm=isch";
  f.controller.writeSnapshotIfRicher(url, "RICH".repeat(60000), 300);
  // Age the cached snapshot two days so the richness guard must yield to freshness.
  const snap = f.controller.snapshotPath(url);
  const old = (Date.now() - 48 * 3600 * 1000) / 1000;
  fsReal.utimesSync(snap, old, old);
  // 100 < 300*0.7 (would be "kept" if recent) -- but it is old, so it must be rewritten.
  assert.equal(f.controller.writeSnapshotIfRicher(url, "POOR".repeat(60000), 100), "written");
  assert.match(fsReal.readFileSync(snap, "utf8"), /^POOR/);
  assert.equal(fsReal.readFileSync(snap + ".n", "utf8"), "100");
});

test("waitImagesSettled returns the dropped count when the page navigates/gates mid-wait", async () => {
  const f = snapFixture();
  const { driver } = loadedDriver([120, 120, 0, 0, 0]); // loaded, then a gate blanks the DOM
  const loaded = await f.controller.waitImagesSettled(driver,
    { timeoutMs: 2000, stableMs: 60, pollMs: 10 });
  assert.equal(loaded, 0); // reports the collapse, so the seed's LOADED_IMAGE_MIN gate skips it
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

test("resetDisplayProfiles is a no-op in seed mode so the live player's se_* survive", () => {
  const dir = fsReal.mkdtempSync(path.join(os.tmpdir(), "tp-snap-"));
  const Controller = controllerClass({ process: { env: {
    TRANSPLAYER_PROFILE_DIR: dir, TRANSPLAYER_SEED: "1" } } });
  const se = path.join(dir, "se_13");
  fsReal.mkdirSync(se, { recursive: true });
  const controller = new Controller(); // constructor must NOT wipe se_* under TRANSPLAYER_SEED=1
  controller.resetDisplayProfiles();
  assert(fsReal.existsSync(se));
});

function servingDriver({ gated = false, images = 500, getCurrentUrl = "https://www.google.com/search?q=x&udm=2" } = {}) {
  const calls = { get: [] };
  return { calls, driver: {
    async get(u) { calls.get.push(u); },
    async getCurrentUrl() { return getCurrentUrl; },
    async executeScript(s) {
      if (String(s).includes("img[src")) return images; // CLEAN_CHECK_JS -> thumbnail count
      return gated;                                      // GATE_CHECK_JS -> gated
    },
  } };
}

test("serveSnapshotIfGated swaps a mid-display gated window to the latest snapshot", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=mid&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  const d = servingDriver({ gated: true });
  f.controller.browsers[13] = { captureUrl: url, driver: d.driver };
  assert.equal(await f.controller.serveSnapshotIfGated(13), true);
  assert.deepEqual(d.calls.get, ["file://" + snap]);
  assert.equal(f.controller.browsers[13].captureUrl, null);
});

test("serveSnapshotIfGated leaves a clean, populated results window alone", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=clean&tbm=isch";
  const d = servingDriver({ gated: false, images: 500 });
  f.controller.browsers[13] = { captureUrl: url, driver: d.driver };
  assert.equal(await f.controller.serveSnapshotIfGated(13), false);
  assert.deepEqual(d.calls.get, []);
});

test("serveSnapshotIfGated swaps an inline-reCAPTCHA / blank page (few images, not /sorry/) to the snapshot", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=inline&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  const d = servingDriver({ gated: false, images: 2 }); // not /sorry/, no gate marker, but ~0 results
  f.controller.waitImagesSettled = async () => {}; // images stay few after re-settle -> still a real empty page
  f.controller.browsers[13] = { captureUrl: url, driver: d.driver };
  assert.equal(await f.controller.serveSnapshotIfGated(13), true);
  assert.deepEqual(d.calls.get, ["file://" + snap]);
});

test("serveSnapshotIfGated keeps a live window that recovers after a resize re-settle (not gated)", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=resize&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  let images = 2; // transiently below threshold while the grid re-lays-out after a maximise
  const calls = { get: [] };
  const driver = {
    async get(u) { calls.get.push(u); },
    async getCurrentUrl() { return "https://www.google.com/search?q=resize&udm=2"; },
    async executeScript(s) { return String(s).includes("img[src") ? images : false; },
  };
  f.controller.waitImagesSettled = async () => { images = 500; }; // grid finishes loading
  f.controller.browsers[13] = { captureUrl: url, driver };
  assert.equal(await f.controller.serveSnapshotIfGated(13), false); // kept live, not swapped
  assert.deepEqual(calls.get, []);                                  // no snapshot served
});

test("serveSnapshotIfGated falls back on a genuine gate without wasting time re-settling", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=gate&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  let resettled = false;
  f.controller.waitImagesSettled = async () => { resettled = true; };
  const d = servingDriver({ gated: true, images: 2 }); // GATE_CHECK_JS -> true
  f.controller.browsers[13] = { captureUrl: url, driver: d.driver };
  assert.equal(await f.controller.serveSnapshotIfGated(13), true);
  assert.equal(resettled, false, "a genuinely gated page must not re-settle");
  assert.deepEqual(d.calls.get, ["file://" + snap]);
});

test("serveSnapshotIfGated (validated mode) keeps live when readiness recovers after a resize re-settle", async () => {
  const f = snapFixture();
  f.controller.validatedSnapshots = true;
  const url = "https://www.google.com/search?q=vresize&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  let ready = false; // grid still re-laying-out after a maximise; not gated
  const calls = { get: [] };
  const driver = {
    async get(u) { calls.get.push(u); },
    async getCurrentUrl() { return "https://www.google.com/search?q=vresize&udm=2"; },
    async executeScript() { return false; }, // GATE_CHECK_JS -> not gated
  };
  f.controller.isCleanResults = async () => ready; // display bar: not gated + enough images
  f.controller.waitImagesSettled = async () => { ready = true; }; // grid finishes loading
  f.controller.browsers[13] = { captureUrl: url, driver };
  assert.equal(await f.controller.serveSnapshotIfGated(13), false); // kept live, not swapped
  assert.deepEqual(calls.get, []);
});

test("serveSnapshotIfGated (validated mode) keeps a live page that has >=25 images but is still lazy-loading (pending>0)", async () => {
  // Regression: a scrolling/maximised live grid keeps loading thumbnails (pending>0) yet is a
  // perfectly good display; it must stay live and NOT be swapped to a snapshot. The display
  // decision uses isCleanResults (not gated + >=IMAGE_RESULT_MIN loaded), not the stricter
  // livePageReady (which additionally needs pending===0).
  const f = snapFixture();
  f.controller.validatedSnapshots = true;
  const url = "https://www.google.com/search?q=worldnews&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  // Not gated, 100 loaded images, but QUALITY_JS reports pending>0 (so livePageReady would be false).
  const calls = { get: [] };
  const driver = {
    async get(u) { calls.get.push(u); },
    async getCurrentUrl() { return "https://www.google.com/search?q=worldnews&udm=2"; },
    async executeScript(s) {
      if (String(s).includes("img[src")) return 100;      // CLEAN_CHECK_JS -> 100 loaded
      if (String(s).includes("pending")) return { loaded: 100, pending: 8 }; // QUALITY_JS
      return false;                                        // GATE_CHECK_JS -> not gated
    },
  };
  f.controller.browsers[13] = { captureUrl: url, driver };
  assert.equal(await f.controller.serveSnapshotIfGated(13), false); // kept live despite pending>0
  assert.deepEqual(calls.get, []);
});

test("refreshServedSnapshotIfNewer reloads when the seed has written a newer snapshot", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=fresh&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "OLD".repeat(40000));
  const d = servingDriver();
  f.controller.browsers[13] = { servedSnapshot: { url, mtime: 0 }, driver: d.driver };
  assert.equal(await f.controller.refreshServedSnapshotIfNewer(13), true);
  assert.deepEqual(d.calls.get, ["file://" + snap]);
});

test("refreshServedSnapshotIfNewer does nothing when the snapshot is unchanged", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=same&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  const mt = fsReal.statSync(snap).mtimeMs;
  const d = servingDriver();
  f.controller.browsers[13] = { servedSnapshot: { url, mtime: mt }, driver: d.driver };
  assert.equal(await f.controller.refreshServedSnapshotIfNewer(13), false);
  assert.deepEqual(d.calls.get, []);
});

test("scrollTo falls back to the snapshot when the page navigates to a gate mid-scroll", async () => {
  const f = snapFixture();
  const url = "https://www.google.com/search?q=navgate&tbm=isch";
  const snap = f.controller.snapshotPath(url);
  fsReal.mkdirSync(path.dirname(snap), { recursive: true });
  fsReal.writeFileSync(snap, "M".repeat(200000));
  const calls = { get: [] };
  const driver = {
    async get(u) { calls.get.push(u); },
    async getCurrentUrl() { return "https://www.google.com/sorry/index?q=navgate"; }, // now gated
    async executeScript(s) {
      if (String(s).includes("scrollBy")) throw new Error("document unloaded"); // mid-scroll navigation
      return true;
    },
  };
  f.controller.getWebDriver = async () => driver;
  f.controller.browsers[13] = { driver, captureUrl: url, scrollState: 0 };
  await f.controller.scrollTo(13, 9000);
  assert.deepEqual(calls.get, ["file://" + snap]); // served the snapshot instead of leaving the gate
  assert.equal(f.controller.browsers[13].captureUrl, null);
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

test('snapshot-only navigation never requests the live search and missing cache fails closed', async () => {
  const f = snapFixture(); f.controller.snapshotOnly = true;
  assert.equal(await f.controller.goTo(13, REQUEST_URL), false);
  assert.deepEqual(f.calls.get, ['about:blank']);
  f.controller.writeSnapshot(REQUEST_URL, acceptedMhtml);
  assert.equal(await f.controller.goTo(13, REQUEST_URL), true);
  assert.equal(f.calls.get[1], 'file://' + f.controller.snapshotPath(REQUEST_URL));
});
test('snapshot-only mode does not replace a page during scrolling or capture the display', async () => {
  const f = snapFixture(); f.controller.snapshotOnly = true;
  f.controller.browsers[13] = { captureUrl: REQUEST_URL, driver: captureDriver(),
    session: { captureSnapshot: async () => { throw Error('display must not capture'); } },
    servedSnapshot: { url: REQUEST_URL, mtime: 0 } };
  f.controller.writeSnapshot(REQUEST_URL, acceptedMhtml);
  await f.controller.refreshServedSnapshotIfNewer(13);
  await f.controller.maybeCapture(13);
  assert.deepEqual(f.calls.get, []);
  assert.equal(f.controller.refreshedSnapshots.size, 0);
});
test('snapshot-only mode cannot trust legacy snapshots accepted with weak quality checks', () => {
  const f = snapFixture();
  f.controller.writeSnapshot(REQUEST_URL, acceptedMhtml);
  f.controller.snapshotOnly = true;
  assert.equal(f.controller.hasSnapshot(REQUEST_URL), false);
});

test('validated live mode falls back on blocked and failed navigation; missing cache blanks', async () => {
  for (const cached of [false, true]) {
    for (const failure of ['gate', 'network']) {
      const f = snapFixture(); f.controller.validatedSnapshots = true;
      if (cached) f.controller.writeSnapshot(REQUEST_URL, acceptedMhtml);
      f.controller.livePageReady = async () => false;
      f.controller.waitImagesSettled = async () => 0;
      const get = f.driver.get;
      f.driver.get = async url => { if (failure === 'network' && url === REQUEST_URL) throw Error('offline'); await get(url); };
      assert.equal(await f.controller.goTo(13, REQUEST_URL), cached);
      assert.equal(f.calls.get.at(-1), cached ? 'file://' + f.controller.snapshotPath(REQUEST_URL) : 'about:blank');
    }
  }
});

test("validated goTo shows the live page when clean with >=25 images even if pending>0 (big maximised grid)", async () => {
  // Measured failure: a maximised live grid reported gated=false loaded=59 pending=41 at goTo, yet
  // the strict livePageReady (pending===0) fell it back to a snapshot. goTo must show live by the
  // DISPLAY bar (isCleanResults), and arm capture (which self-gates on full load).
  const f = snapFixture();
  f.controller.validatedSnapshots = true;
  f.controller.waitImagesSettled = async () => 100;
  f.controller.browsers[13] = {}; // so _markCapture can record captureUrl
  const url = "https://www.google.com/search?q=worldnews&tbm=isch";
  f.driver.executeScript = async (s) => {
    if (String(s).includes("img[src")) return 100;                 // CLEAN_CHECK_JS -> 100 loaded
    if (String(s).includes("pending")) return { loaded: 100, pending: 41 }; // QUALITY_JS
    return false;                                                  // GATE_CHECK_JS -> not gated
  };
  assert.equal(await f.controller.goTo(13, url), true);
  assert.deepEqual(f.calls.get, [url]);                 // showed live; did NOT serve a file:// snapshot
  assert.equal(f.controller.browsers[13].captureUrl, url); // armed for capture + mid-display protection
});
test('validated live and snapshot-only modes share the accepted cache', () => {
  const f = snapFixture(); f.controller.validatedSnapshots = true;
  f.controller.writeSnapshot(REQUEST_URL, acceptedMhtml);
  f.controller.snapshotOnly = true;
  assert(f.controller.hasSnapshot(REQUEST_URL));
});

// --- rc20: the LIVE display-refresh captures a clean lazy-load grid (loaded>=DISPLAY_CAPTURE_MIN),
// newest clean capture wins, and a grey/incomplete page is never saved. ---
// A driver whose CLEAN_CHECK_JS returns `clean`, QUALITY_JS returns {loaded,pending}, and the gate
// check returns `gated`. `gatedSeq`, when given, returns successive gate values (to flip mid-capture).
function qualityDriver({ clean = 100, loaded = 100, pending = 0, gated = false, gatedSeq } = {}) {
  let g = 0;
  return {
    async getCurrentUrl() { return "https://www.google.com/search?q=x&udm=2"; },
    async executeScript(s) {
      if (String(s).includes("img[src")) return clean;               // CLEAN_CHECK_JS
      if (String(s).includes("pending")) return { loaded, pending }; // QUALITY_JS
      if (gatedSeq) return gatedSeq[Math.min(g++, gatedSeq.length - 1)];
      return gated;                                                  // GATE_CHECK_JS
    },
  };
}

test("maybeCapture (validated) refreshes a clean lazy-load grid at loaded>=40 even with pending>0", async () => {
  const f = snapFixture();
  f.controller.validatedSnapshots = true;
  const url = "https://www.google.com/search?q=explosion%20news&tbm=isch";
  let captures = 0;
  f.controller.browsers[13] = { captureUrl: url,
    driver: qualityDriver({ clean: 59, loaded: 59, pending: 41 }),
    session: { captureSnapshot: async () => { captures++; return acceptedMhtml; } } };
  await f.controller.maybeCapture(13);
  assert.equal(captures, 1);                               // strict captureQuality (loaded>=100) would have skipped
  assert(fsReal.existsSync(f.controller.snapshotPath(url)));
  assert.equal(f.controller.snapshotLoadedCount(url), 59); // .n records the loaded count
});

test("maybeCapture (validated) skips a page below the DISPLAY_CAPTURE_MIN image floor", async () => {
  const f = snapFixture();
  f.controller.validatedSnapshots = true;
  const url = "https://www.google.com/search?q=sparse&tbm=isch";
  let captures = 0;
  f.controller.browsers[13] = { captureUrl: url,
    driver: qualityDriver({ clean: 30, loaded: 30, pending: 5 }),
    session: { captureSnapshot: async () => { captures++; return acceptedMhtml; } } };
  await f.controller.maybeCapture(13);
  assert.equal(captures, 0);                               // 30 < 40 -> not a full-enough page
  assert(!fsReal.existsSync(f.controller.snapshotPath(url)));
});

test("maybeCapture (validated) never captures a grey / gated page", async () => {
  const f = snapFixture();
  f.controller.validatedSnapshots = true;
  const url = "https://www.google.com/search?q=grey&tbm=isch";
  let captures = 0;
  f.controller.browsers[13] = { captureUrl: url,
    driver: qualityDriver({ clean: 0, loaded: 80, pending: 0, gated: true }),
    session: { captureSnapshot: async () => { captures++; return acceptedMhtml; } } };
  await f.controller.maybeCapture(13);
  assert.equal(captures, 0);                               // gated -> never cached, whatever the counts
  assert(!fsReal.existsSync(f.controller.snapshotPath(url)));
});

test("maybeCapture (validated) drops a page that turns grey mid-capture", async () => {
  const f = snapFixture();
  f.controller.validatedSnapshots = true;
  const url = "https://www.google.com/search?q=flip&tbm=isch";
  let captures = 0;
  // Not gated on the first inspect (capture proceeds), gated on the re-check after capture.
  f.controller.browsers[13] = { captureUrl: url,
    driver: qualityDriver({ clean: 50, loaded: 50, pending: 5, gatedSeq: [false, true] }),
    session: { captureSnapshot: async () => { captures++; return acceptedMhtml; } } };
  await f.controller.maybeCapture(13);
  assert.equal(captures, 1);                               // captured, but the re-check rejected it
  assert(!fsReal.existsSync(f.controller.snapshotPath(url)));
});

test("maybeCapture (validated) newest clean capture overwrites a richer existing snapshot", async () => {
  const f = snapFixture();
  f.controller.validatedSnapshots = true;
  const url = REQUEST_URL;
  f.controller.writeSnapshot(url, acceptedMhtml);
  fsReal.writeFileSync(f.controller.snapshotPath(url) + ".n", "300"); // pretend the existing one is very rich
  const fresh = acceptedMhtml.replace("M".repeat(200000), "N".repeat(200000));
  f.controller.browsers[13] = { captureUrl: url,
    driver: qualityDriver({ clean: 45, loaded: 45, pending: 10 }),
    session: { captureSnapshot: async () => fresh } };
  await f.controller.maybeCapture(13);
  assert(fsReal.readFileSync(f.controller.snapshotPath(url), "utf8").includes("N".repeat(200000)));
  assert.equal(f.controller.snapshotLoadedCount(url), 45); // newest wins even though existing was richer
});

test('validated live readiness rejects incomplete and broken pages while accepting loaded results', async () => {
  const f = snapFixture(); f.controller.isCleanResults = async () => true;
  // VM controller dependencies resolve relative to this test; inject production policy module.
  const C = controllerClass({ modules: { './seeder': require('../seeder') } });
  const c = new C(); c.isCleanResults = async () => true;
  assert.equal(await c.livePageReady({ executeScript: async () => ({ loaded: 120, pending: 0 }) }), true);
  assert.equal(await c.livePageReady({ executeScript: async () => ({ loaded: 120, pending: 1 }) }), false);
  assert.equal(await c.livePageReady({ executeScript: async () => { throw Error('gone'); } }), false);
});

test('validated writer refuses a nested challenge and retains the prior accepted archive', () => {
  const f=snapFixture();f.controller.validatedSnapshots=true;
  assert.equal(f.controller.writeSnapshot(REQUEST_URL,acceptedMhtml),true);
  const before=fsReal.readFileSync(f.controller.snapshotPath(REQUEST_URL),'utf8');
  const hostile=acceptedMhtml.replace('--x--','--x\r\nContent-Type: text/html\r\nContent-Transfer-Encoding: base64\r\n\r\n'+Buffer.from('<body>unusual traffic</body>').toString('base64')+'\r\n--x--');
  assert.equal(f.controller.writeSnapshot(REQUEST_URL,hostile),false);
  assert.equal(fsReal.readFileSync(f.controller.snapshotPath(REQUEST_URL),'utf8'),before);
});
test('page challenge check includes archived child documents and sorry frame URLs', () => {
  const C=controllerClass();
  function doc(text='',frames=[]) { return {body:{innerText:text},querySelectorAll:()=>frames}; }
  const check=document=>vm.runInNewContext(C.GATE_CHECK_JS,{document,location:{pathname:'/search'}});
  assert.equal(check(doc('Image results')),false);
  assert.equal(check(doc('Images',[{src:'cid:frame',contentDocument:doc('Our systems have detected unusual traffic')} ])),true);
  assert.equal(check(doc('Images',[{src:'https://www.google.com/sorry/index',contentDocument:null}])),true);
});
