const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => require("../chrome-session");

function fixture() {
  const calls = [];
  let now = 0;
  const child = { pid: 1234, exitCode: null, signalCode: null,
    once() {}, stdout: { resume() {} }, stderr: { resume() {} },
    kill(signal) { calls.push(["kill", signal]); this.exitCode = 0; } };
  const driver = { async quit() { calls.push(["quit"]); } };
  const service = { async start() { calls.push(["service-start"]); return "http://127.0.0.1:4444"; },
    async kill() { calls.push(["service-stop"]); } };
  const deps = {
    now: () => now,
    sleep: async ms => { now += ms; },
    prepareProfile: async profile => { calls.push(["profile", profile]); },
    allocatePort: async () => 23456,
    spawn(binary, args) { calls.push(["spawn", binary, args]); return child; },
    inspectEndpoint: () => true,
    readVersion: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1:23456/devtools/browser/abc-123" }),
    createService: () => service,
    connect: async (url, address) => { calls.push(["connect", url, address]); return driver; },
    closeBrowser: async () => { calls.push(["browser-close"]); child.exitCode = 0; },
    waitExit: async () => child.exitCode !== null || child.signalCode !== null,
    portReleased: () => true,
  };
  return { child, driver, service, deps, calls,
    options: { chromePath: "/opt/transplayer/releases/r9.AppDir/browser/chrome",
      driverPath: "/opt/transplayer/releases/r9.AppDir/app/bin/chrome/chromedriver",
      profileDir: "/synthetic/profiles-r9/se_13", timeoutMs: 30, pollMs: 10 } };
}

test("Chrome-first starts normal Chrome before connecting and owns every resource", async () => {
  const { ChromeSession } = load(), f = fixture();
  const session = new ChromeSession(f.options, f.deps);
  assert.equal(await session.start(), session);
  assert.equal(session.driver, f.driver);
  const args = f.calls.find(c => c[0] === "spawn")[2];
  assert(args.includes("--remote-debugging-address=127.0.0.1"));
  assert(args.includes("--remote-debugging-port=23456"));
  assert(args.includes("--user-data-dir=/synthetic/profiles-r9/se_13"));
  assert(args.includes("--ozone-platform=x11"));
  assert(args.includes("--password-store=basic"));
  for (const forbidden of ["--no-sandbox", "--disable-gpu-sandbox", "--enable-automation", "--load-extension"])
    assert(!args.some(a => a.startsWith(forbidden)));
  assert(f.calls.findIndex(c => c[0] === "spawn") < f.calls.findIndex(c => c[0] === "connect"));
  assert.equal(f.calls.find(c => c[0] === "connect")[2], "127.0.0.1:23456");
  await session.close();
  assert.deepEqual(f.calls.filter(c => ["quit","browser-close","service-stop"].includes(c[0])).map(c => c[0]),
    ["quit", "browser-close", "service-stop"]);
});

test("exhibition Chrome suppresses the crash restore bubble on initial launch", async () => {
  const f = fixture(), session = new (load().ChromeSession)(f.options, f.deps);
  try {
    await session.start();
    const args = f.calls.find(c => c[0] === "spawn")[2];
    assert(args.includes("--hide-crash-restore-bubble"));
    assert(!args.includes("--restore-last-session"));
    assert.equal(args.filter(a => a.startsWith("--user-data-dir=")).length, 1);
  } finally {
    await session.close();
  }
});

test("replacement Chrome suppresses restore UI while reusing the dedicated profile", async () => {
  const f = fixture(), session = new (load().ChromeSession)(f.options, f.deps);
  await session.start();
  f.child.signalCode = "SIGKILL";
  await session.close();
  const replacement = fixture();
  replacement.options.profileDir = f.options.profileDir;
  const next = new (load().ChromeSession)(replacement.options, replacement.deps);
  try {
    await next.start();
    const args = replacement.calls.find(c => c[0] === "spawn")[2];
    assert(args.includes("--hide-crash-restore-bubble"));
    assert(args.includes("--user-data-dir=" + f.options.profileDir));
    assert(!args.includes("--restore-last-session"));
  } finally {
    await next.close();
  }
});


test("chrome-first loads the CAPTCHA solver extension when its directory is resolved", async () => {
  const f = fixture();
  f.deps.captchaExtension = () => "/opt/transplayer/releases/r10.AppDir/app/nopecha";
  const session = new (load().ChromeSession)(f.options, f.deps);
  try {
    await session.start();
    const args = f.calls.find(c => c[0] === "spawn")[2];
    assert.equal(args.filter(a =>
      a === "--load-extension=/opt/transplayer/releases/r10.AppDir/app/nopecha").length, 1);
  } finally { await session.close(); }
});

test("chrome-first omits the solver when no extension directory is resolved", async () => {
  const f = fixture();
  f.deps.captchaExtension = () => null;
  const session = new (load().ChromeSession)(f.options, f.deps);
  try {
    await session.start();
    const args = f.calls.find(c => c[0] === "spawn")[2];
    assert(!args.some(a => a.startsWith("--load-extension")));
  } finally { await session.close(); }
});

test("captchaExtensionDir honours the disable flag and requires the directory", () => {
  const { captchaExtensionDir } = load();
  const os = require("node:os"), fsp = require("node:fs"), p = require("node:path");
  const base = fsp.mkdtempSync(p.join(os.tmpdir(), "cs-ext-"));
  try {
    assert.equal(captchaExtensionDir(base, {}), null); // no nopecha subdir
    fsp.mkdirSync(p.join(base, "nopecha"));
    assert.equal(captchaExtensionDir(base, {}), p.join(base, "nopecha"));
    assert.equal(captchaExtensionDir(base, { TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION: "1" }), null);
  } finally { fsp.rmSync(base, { recursive: true, force: true }); }
});

for (const replacement of [false, true]) {
  test(`${replacement ? "replacement" : "initial"} Chrome suppresses noninteractive infobars without bypassing site security`, async () => {
    if (replacement) {
      const previous = fixture();
      const old = new (load().ChromeSession)(previous.options, previous.deps);
      await old.start();
      previous.child.signalCode = "SIGKILL";
      await old.close();
    }
    const f = fixture(), session = new (load().ChromeSession)(f.options, f.deps);
    try {
      await session.start();
      const args = f.calls.find(c => c[0] === "spawn")[2];
      assert.equal(args.filter(a => a === "--disable-infobars").length, 1);
      // reCAPTCHA mitigation ported from r8/r7b (controller.js:246): reduce the
      // AutomationControlled blink signal on the live chrome-first launch path.
      assert.equal(args.filter(a => a === "--disable-blink-features=AutomationControlled").length, 1);
      for (const forbidden of ["--ignore-certificate-errors", "--disable-web-security",
        "--no-sandbox", "--disable-gpu-sandbox", "--safebrowsing-disable-auto-update"])
        assert(!args.some(a => a.startsWith(forbidden)), forbidden);
    } finally {
      await session.close();
    }
  });
}

test("basic storage refuses an existing unclaimed browser profile", () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const { ChromeSession } = load();
  const prepareProfile = new ChromeSession({}).deps.prepareProfile;
  assert.equal(typeof prepareProfile, "function");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-profile-test-"));
  try {
    const dedicated = path.join(root, "exhibition");
    prepareProfile(dedicated);
    assert.equal(fs.statSync(path.join(dedicated, ".transplayer-profile")).mode & 0o777, 0o600);
    prepareProfile(dedicated);
    const unrelated = path.join(root, "existing");
    fs.mkdirSync(unrelated, { mode: 0o700 });
    fs.writeFileSync(path.join(unrelated, "Preferences"), "synthetic fixture");
    assert.throws(() => prepareProfile(unrelated), /dedicated|exhibition|unclaimed/i);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test("a dead same-host Chrome lock is left for Chromium to recover", () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const prepareProfile = new (load().ChromeSession)({}).deps.prepareProfile;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-stale-lock-"));
  try {
    const profile = path.join(root, "se_13");
    prepareProfile(profile);
    const lock = path.join(profile, "SingletonLock");
    const target = `${os.hostname()}-2147483647`;
    fs.symlinkSync(target, lock);
    assert.doesNotThrow(() => prepareProfile(profile));
    assert.equal(fs.readlinkSync(lock), target, "preflight must not remove Chrome's lock");
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test("live, foreign and malformed Chrome locks are never adopted", () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const prepareProfile = new (load().ChromeSession)({}).deps.prepareProfile;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-unsafe-lock-"));
  try {
    for (const [name, target] of [
      ["live", `${os.hostname()}-${process.pid}`],
      ["foreign", `another-host-${process.pid}`],
      ["bad-pid", `${os.hostname()}-not-a-pid`],
      ["path", `../${os.hostname()}-2147483647`],
    ]) {
      const profile = path.join(root, name);
      prepareProfile(profile);
      const lock = path.join(profile, "SingletonLock");
      fs.symlinkSync(target, lock);
      assert.throws(() => prepareProfile(profile), /locked|unsafe/i, name);
      assert.equal(fs.readlinkSync(lock), target);
    }
    const regular = path.join(root, "regular");
    prepareProfile(regular);
    fs.writeFileSync(path.join(regular, "SingletonLock"), "not a Chrome lock");
    assert.throws(() => prepareProfile(regular), /locked|unsafe/i);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});
function profileCase(run) {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-dialogs-"));
  const profile = path.join(root, "exhibition");
  const prepare = new (load().ChromeSession)({}).deps.prepareProfile;
  try {
    prepare(profile);
    const defaults = path.join(profile, "Default");
    const preferences = path.join(defaults, "Preferences");
    if (!fs.existsSync(defaults)) fs.mkdirSync(defaults, { mode: 0o700 });
    if (!fs.existsSync(preferences)) fs.writeFileSync(preferences, "{}", { mode: 0o600 });
    run({ fs, path, root, profile, prepare,
      defaults: path.join(profile, "Default"),
      preferences: path.join(profile, "Default", "Preferences") });
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}

test("fresh dedicated profile disables offers and denies unsolicited permissions", () => {
  profileCase(({ fs, defaults, preferences }) => {
    const value = JSON.parse(fs.readFileSync(preferences, "utf8"));
    assert.equal(value.translate.enabled, false);
    for (const key of ["credentials_enable_service", "credentials_enable_autosignin",
      "credentials_enable_automatic_passkey_upgrades"]) assert.equal(value[key], false, key);
    assert.equal(value.autofill.profile_enabled, false);
    assert.equal(value.autofill.credit_card_enabled, false);
    for (const key of ["notifications", "geolocation", "media_stream_camera", "media_stream_mic"])
      assert.equal(value.profile.default_content_setting_values[key], 2, key);
    assert.equal(fs.statSync(defaults).mode & 0o777, 0o700);
    assert.equal(fs.statSync(preferences).mode & 0o777, 0o600);
  });
});

test("reopening merges only exhibition preferences and is byte-idempotent", () => {
  profileCase(({ fs, preferences, prepare, profile }) => {
    const value = { translate: { enabled: true, retained: ["en"] },
      autofill: { retained: true }, profile: {
        default_content_setting_values: { notifications: 1, javascript: 1 },
        content_settings: { exceptions: { notifications: { "https://synthetic.invalid,*": { setting: 1 } } } } },
      safebrowsing: { enabled: true }, custom: { text: "測試設定" } };
    fs.writeFileSync(preferences, JSON.stringify(value), { mode: 0o600 });
    prepare(profile);
    const merged = JSON.parse(fs.readFileSync(preferences, "utf8"));
    assert.equal(merged.translate.enabled, false);
    assert.deepEqual(merged.translate.retained, ["en"]);
    assert.deepEqual(merged.profile.content_settings, value.profile.content_settings);
    assert.equal(merged.profile.default_content_setting_values.javascript, 1);
    assert.deepEqual(merged.safebrowsing, value.safebrowsing);
    assert.deepEqual(merged.custom, value.custom);
    const before = fs.readFileSync(preferences);
    prepare(profile);
    assert.deepEqual(fs.readFileSync(preferences), before);
  });
});

test("malformed JSON and unsafe nested preference nodes are refused without mutation", () => {
  for (const text of ["{", "null", "[]", "42", '{"translate":[]}',
    '{"profile":null}', '{"profile":{"default_content_setting_values":"unsafe"}}']) {
    profileCase(({ fs, preferences, prepare, profile }) => {
      fs.writeFileSync(preferences, text, { mode: 0o600 });
      assert.throws(() => prepare(profile), /preference|object|JSON/i);
      assert.equal(fs.readFileSync(preferences, "utf8"), text);
    });
  }
});

test("symlinked, hardlinked and permissive preference paths are refused", () => {
  for (const kind of ["directory-link", "file-link", "hardlink", "directory-mode", "file-mode"]) {
    profileCase(({ fs, path, root, defaults, preferences, prepare, profile }) => {
      const outside = path.join(root, "outside");
      fs.writeFileSync(outside, '{"unrelated":true}', { mode: 0o600 });
      if (kind === "directory-link") {
        const target = path.join(root, "other-default");
        fs.mkdirSync(target, { mode: 0o700 });
        fs.renameSync(defaults, path.join(root, "saved-default"));
        fs.symlinkSync(target, defaults);
      } else if (kind === "file-link" || kind === "hardlink") {
        fs.renameSync(preferences, path.join(root, "saved-preferences"));
        if (kind === "file-link") fs.symlinkSync(outside, preferences);
        else fs.linkSync(outside, preferences);
      } else {
        fs.chmodSync(kind === "file-mode" ? preferences : defaults, 0o777);
      }
      assert.throws(() => prepare(profile), /unsafe|preference/i, kind);
      assert.equal(fs.readFileSync(outside, "utf8"), '{"unrelated":true}');
    });
  }
});

test("live profile lock refuses preference changes before touching bytes", () => {
  profileCase(({ fs, path, preferences, prepare, profile }) => {
    const text = '{"translate":{"enabled":true}}';
    fs.writeFileSync(preferences, text, { mode: 0o600 });
    fs.symlinkSync(`${require("node:os").hostname()}-${process.pid}`,
      path.join(profile, "SingletonLock"));
    assert.throws(() => prepare(profile), /locked/i);
    assert.equal(fs.readFileSync(preferences, "utf8"), text);
  });
});

test("real attachment capabilities dismiss rather than accept unexpected JavaScript prompts", async () => {
  let captured;
  class Builder {
    usingServer() { return this; }
    withCapabilities(value) { captured = value; return this; }
    build() { return Promise.resolve({}); }
  }
  const sandbox = { module: { exports: {} }, process, setTimeout, clearTimeout,
    require: name => name === "selenium-webdriver" ? { Builder } : require(name) };
  require("node:vm").runInNewContext(
    require("node:fs").readFileSync(require.resolve("../chrome-session"), "utf8"), sandbox);
  const session = new sandbox.module.exports.ChromeSession({});
  await session.deps.connect("http://127.0.0.1:4444", "127.0.0.1:23456");
  assert.equal(captured.unhandledPromptBehavior, "dismiss");
  assert.equal(captured["goog:chromeOptions"].debuggerAddress, "127.0.0.1:23456");
});

test("initial and replacement starts prepare real dedicated preferences before spawning", async () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-dialog-launch-"));
  const profile = path.join(root, "exhibition");
  const preferences = path.join(profile, "Default", "Preferences");
  try {
    for (const replacement of [false, true]) {
      if (replacement)
        fs.writeFileSync(preferences, '{"translate":{"enabled":true}}', { mode: 0o600 });
      const f = fixture();
      f.options.profileDir = profile;
      f.deps.prepareProfile = new (load().ChromeSession)({}).deps.prepareProfile;
      const spawn = f.deps.spawn;
      f.deps.spawn = (binary, args) => {
        assert.equal(JSON.parse(fs.readFileSync(preferences, "utf8")).translate.enabled, false);
        assert(args.includes("--disable-infobars"));
        return spawn(binary, args);
      };
      const session = new (load().ChromeSession)(f.options, f.deps);
      try { await session.start(); }
      finally { await session.close(); }
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test("actual socket inspector checks loopback inode ownership and live child identity", () => {
  const { inspectEndpoint } = load();
  const f = fixture();
  let address = "0100007F", inode = "99";
  const io = {
    readFileSync(file) {
      return file.endsWith("tcp6") ? "header\n" :
        `header\n0: ${address}:5BA0 00000000:0000 0A 0:0 0:0 0 1000 0 ${inode}\n`;
    },
    readdirSync: () => ["5"],
    readlinkSync: () => "socket:[99]",
  };
  assert.equal(inspectEndpoint(f.child, 23456, io), true);
  inode = "100";
  assert.throws(() => inspectEndpoint(f.child, 23456, io), /not owned/i);
  inode = "99"; address = "00000000";
  assert.throws(() => inspectEndpoint(f.child, 23456, io), /loopback/i);
  address = "0100007F"; f.child.exitCode = 0;
  assert.throws(() => inspectEndpoint(f.child, 23456, io), /exited|identity/i);
});

test("concurrent starts and closes share their operations", async () => {
  const { ChromeSession } = load(), f = fixture(), session = new ChromeSession(f.options, f.deps);
  await Promise.all([session.start(), session.start()]);
  await Promise.all([session.close(), session.close()]);
  for (const name of ["spawn", "connect", "quit", "browser-close", "service-stop"])
    assert.equal(f.calls.filter(c => c[0] === name).length, 1, name);
});

test("a foreign debugger socket is rejected before reading or connecting", async () => {
  const { ChromeSession } = load(), f = fixture();
  f.deps.inspectEndpoint = () => { throw Error("Debugger listener is not owned"); };
  f.deps.readVersion = async () => { assert.fail("must not read foreign endpoint"); };
  await assert.rejects(new ChromeSession(f.options, f.deps).start(), /not owned/);
  assert(f.calls.some(c => c[0] === "kill"));
  assert(!f.calls.some(c => c[0] === "connect"));
});

test("debugger URL must be the exact loopback port and browser endpoint", () => {
  const { validateDebugger } = load();
  assert.equal(validateDebugger("ws://127.0.0.1:23456/devtools/browser/abc-123", 23456),
    "ws://127.0.0.1:23456/devtools/browser/abc-123");
  for (const url of [
    "ws://example.com:23456/devtools/browser/abc-123",
    "ws://127.0.0.1.evil.test:23456/devtools/browser/abc-123",
    "ws://127.0.0.1:23457/devtools/browser/abc-123",
    "ws://user:password@127.0.0.1:23456/devtools/browser/abc-123",
    "ws://127.0.0.1:23456/devtools/page/abc-123",
    "ws://127.0.0.1:23456/devtools/browser/abc-123?token=hidden",
    "ws://127.0.0.1:23456/devtools/browser/abc-123\n",
  ]) assert.throws(() => validateDebugger(url, 23456), /debugger/i);
  assert.throws(() => validateDebugger("ws://127.0.0.1:23456/devtools/browser/abc", "23456"), /debugger/i);
});

test("a forged version response is rejected and the owned child is stopped", async () => {
  const { ChromeSession } = load(), f = fixture();
  f.deps.readVersion = async () => ({ webSocketDebuggerUrl: "ws://evil.test/devtools/browser/abc" });
  await assert.rejects(new ChromeSession(f.options, f.deps).start(), /debugger/i);
  assert(f.calls.some(c => c[0] === "kill"));
  assert(!f.calls.some(c => c[0] === "connect"));
});

test("startup timeout stops its owned Chrome without creating a Driver", async () => {
  const { ChromeSession } = load(), f = fixture();
  f.deps.inspectEndpoint = () => false;
  await assert.rejects(new ChromeSession(f.options, f.deps).start(), /timed out/i);
  assert(f.calls.some(c => c[0] === "kill"));
  assert(!f.calls.some(c => c[0] === "service-start"));
});

test("early child exit fails without connecting to a leftover port", async () => {
  const { ChromeSession } = load(), f = fixture();
  f.child.exitCode = 1;
  await assert.rejects(new ChromeSession(f.options, f.deps).start(), /exited/i);
  assert(!f.calls.some(c => c[0] === "connect"));
});

test("service-start failure closes Chrome and disposes the service", async () => {
  const { ChromeSession } = load(), f = fixture();
  f.service.start = async () => { throw Error("service startup failed"); };
  await assert.rejects(new ChromeSession(f.options, f.deps).start(), /service startup failed/);
  assert(f.calls.some(c => c[0] === "browser-close"));
  assert(f.calls.some(c => c[0] === "service-stop"));
});

test("attach failure disposes both owned Chrome and Driver service", async () => {
  const { ChromeSession } = load(), f = fixture();
  f.deps.connect = async () => { throw Error("attach rejected"); };
  await assert.rejects(new ChromeSession(f.options, f.deps).start(), /attach rejected/);
  assert(f.calls.some(c => c[0] === "browser-close"));
  assert(f.calls.some(c => c[0] === "service-stop"));
});

test("failed quit still closes Chrome and its service and preserves the error", async () => {
  const { ChromeSession } = load(), f = fixture();
  f.driver.quit = async () => { throw Error("synthetic driver quit failure"); };
  const session = new ChromeSession(f.options, f.deps);
  await session.start();
  await assert.rejects(session.close(), /cleanup/i);
  assert(f.calls.some(c => c[0] === "browser-close"));
  assert(f.calls.some(c => c[0] === "service-stop"));
});

test("Browser.close failure uses only the owned child fallback", async () => {
  const { ChromeSession } = load(), f = fixture();
  f.deps.closeBrowser = async () => { throw Error("CDP close failed"); };
  const session = new ChromeSession(f.options, f.deps);
  await session.start();
  await assert.rejects(session.close(), /cleanup/i);
  assert.deepEqual(f.calls.find(c => c[0] === "kill"), ["kill", "SIGTERM"]);
  assert(f.calls.some(c => c[0] === "service-stop"));
});

test("stopping during startup prevents later driver attachment", async () => {
  const { ChromeSession } = load(), f = fixture();
  let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  f.deps.readVersion = () => { entered(); return new Promise(resolve => { release = resolve; }); };
  const session = new ChromeSession(f.options, f.deps);
  const starting = session.start();
  await ready;
  const stopping = session.close();
  release({ webSocketDebuggerUrl: "ws://127.0.0.1:23456/devtools/browser/abc-123" });
  await assert.rejects(starting, /stopped/i);
  await stopping;
  assert(!f.calls.some(c => c[0] === "connect"));
});

test("unsafe profile or binary arguments fail before spawning", async () => {
  const { ChromeSession } = load();
  for (const override of [
    { chromePath: "relative/chrome" }, { profileDir: "relative/profile" },
    { driverPath: "/driver\ninjection" }, { profileDir: "/profile\0injection" },
  ]) {
    const f = fixture();
    await assert.rejects(new ChromeSession({ ...f.options, ...override }, f.deps).start(), /path|argument/i);
    assert(!f.calls.some(c => c[0] === "spawn"));
  }
});

test("profile preparation failure never spawns a browser", async () => {
  const { ChromeSession } = load(), f = fixture();
  f.deps.prepareProfile = async () => { throw Error("Profile already locked"); };
  await assert.rejects(new ChromeSession(f.options, f.deps).start(), /locked/i);
  assert(!f.calls.some(c => c[0] === "spawn"));
});
