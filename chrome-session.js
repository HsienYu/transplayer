const fs = require("fs");
const path = require("path");
const os = require("os");
const net = require("net");
const http = require("http");
const { spawn } = require("child_process");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function alive(child) {
  return child && child.exitCode === null && child.signalCode === null;
}
function validateDebugger(value, port) {
  if (!Number.isSafeInteger(port) || port <= 1024 || port > 65535 ||
      typeof value !== "string" || /[\0\r\n]/.test(value) ||
      !new RegExp(`^ws://127\\.0\\.0\\.1:${port}/devtools/browser/[a-zA-Z0-9-]+$`).test(value)) {
    throw new Error("Invalid owned debugger endpoint");
  }
  return value;
}
function sockets(port, io = fs) {
  const hex = port.toString(16).toUpperCase().padStart(4, "0");
  return ["/proc/net/tcp", "/proc/net/tcp6"].flatMap(file =>
    io.readFileSync(file, "utf8").trim().split("\n").slice(1)
      .map(line => line.trim().split(/\s+/))
      .filter(fields => fields[1].split(":")[1] === hex && fields[3] === "0A")
      .map(fields => ({ address: fields[1].split(":")[0], inode: fields[9] })));
}
function inspectEndpoint(child, port, io = fs) {
  if (!alive(child) || !Number.isSafeInteger(child.pid) || child.pid <= 0)
    throw new Error("Owned Chrome exited or has invalid identity");
  const listening = sockets(port, io);
  if (!listening.length) return false;
  if (!listening.every(socket => socket.address === "0100007F"))
    throw new Error("Debugger is not restricted to IPv4 loopback");
  const directory = `/proc/${child.pid}/fd`;
  const owned = new Set();
  for (const fd of io.readdirSync(directory)) {
    try {
      const match = /^socket:\[(\d+)\]$/.exec(io.readlinkSync(`${directory}/${fd}`));
      if (match) owned.add(match[1]);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (!listening.every(socket => owned.has(socket.inode)))
    throw new Error("Debugger listener is not owned by the spawned Chrome");
  return true;
}
function preparePreferences(directory) {
  const defaults = path.join(directory, "Default");
  try { fs.mkdirSync(defaults, { mode: 0o700 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  const parent = fs.lstatSync(defaults);
  if (!parent.isDirectory() || parent.isSymbolicLink() ||
      parent.uid !== process.getuid() || (parent.mode & 0o077))
    throw new Error("Unsafe Chrome preferences directory");
  const preferences = path.join(defaults, "Preferences");
  let original = null, text = null;
  let fd;
  try {
    fd = fs.openSync(preferences, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW |
      fs.constants.O_NONBLOCK);
    original = fs.fstatSync(fd);
    if (!original.isFile() || original.uid !== process.getuid() ||
        original.nlink !== 1 || (original.mode & 0o077) || original.size > 8 * 1024 * 1024)
      throw new Error("Unsafe Chrome preferences file");
    text = fs.readFileSync(fd, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      if (error.code === "ELOOP") throw new Error("Unsafe Chrome preferences symlink");
      throw error;
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  let value;
  try { value = text === null ? {} : JSON.parse(text); }
  catch (_) { throw new Error("Invalid Chrome preferences JSON"); }
  const object = node => node !== null && typeof node === "object" && !Array.isArray(node);
  if (!object(value)) throw new Error("Chrome preferences must be an object");
  // Chromium156 pref names: translate_pref_names.h, password_manager_pref_names.h,
  // autofill_prefs.h. This is the manually spawned browser's on-disk profile.
  const settings = [
    ["translate.enabled", false],
    ["credentials_enable_service", false],
    ["credentials_enable_autosignin", false],
    ["credentials_enable_automatic_passkey_upgrades", false],
    ["autofill.profile_enabled", false],
    ["autofill.credit_card_enabled", false],
    ...["notifications", "geolocation", "media_stream_camera", "media_stream_mic"]
      .map(key => ["profile.default_content_setting_values." + key, 2]),
  ];
  for (const [key, setting] of settings) {
    const parts = key.split(".");
    let node = value;
    for (const part of parts.slice(0, -1)) {
      if (!Object.prototype.hasOwnProperty.call(node, part)) node[part] = {};
      if (!object(node[part])) throw new Error("Chrome preference nodes must be objects");
      node = node[part];
    }
    node[parts[parts.length - 1]] = setting;
  }
  const output = JSON.stringify(value) + "\n";
  if (output === text) return;
  const temporary = path.join(defaults, ".transplayer-prefs-" +
    require("crypto").randomBytes(12).toString("hex"));
  let created = false;
  try {
    fd = fs.openSync(temporary, "wx", 0o600);
    created = true;
    try {
      fs.writeFileSync(fd, output);
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    const currentParent = fs.lstatSync(defaults);
    if (currentParent.dev !== parent.dev || currentParent.ino !== parent.ino)
      throw new Error("Chrome preferences directory changed during preparation");
    if (original) {
      const current = fs.lstatSync(preferences);
      if (current.dev !== original.dev || current.ino !== original.ino ||
          current.nlink !== 1 || current.size !== original.size ||
          current.mtimeMs !== original.mtimeMs)
        throw new Error("Chrome preferences changed during preparation");
    } else if (fs.existsSync(preferences)) {
      throw new Error("Chrome preferences appeared during preparation");
    }
    fs.renameSync(temporary, preferences);
    created = false;
  } finally {
    if (created) fs.unlinkSync(temporary);
  }
}
function prepareProfile(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const info = fs.lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() ||
      (info.mode & 0o077)) throw new Error("Unsafe Chrome profile directory");
  const marker = path.join(directory, ".transplayer-profile");
  const purpose = "transplayer-exhibition-basic-v1\n";
  if (fs.readdirSync(directory).length === 0) {
    fs.writeFileSync(marker, purpose, { flag: "wx", mode: 0o600 });
  } else {
    let claimed;
    try { claimed = fs.lstatSync(marker); }
    catch (error) {
      if (error.code === "ENOENT") throw new Error("Refuse unclaimed non-exhibition profile");
      throw error;
    }
    if (!claimed.isFile() || claimed.isSymbolicLink() || claimed.uid !== process.getuid() ||
        (claimed.mode & 0o077) || fs.readFileSync(marker, "utf8") !== purpose)
      throw new Error("Invalid dedicated exhibition profile marker");
  }
  const lockPath = path.join(directory, "SingletonLock");
  let lock;
  try { lock = fs.lstatSync(lockPath); }
  catch (error) {
    if (error.code === "ENOENT") return preparePreferences(directory);
    throw error;
  }
  const locked = () => new Error("Chrome profile already locked; preserve it for operator review");
  if (!lock.isSymbolicLink() || lock.uid !== process.getuid()) throw locked();
  const prefix = `${os.hostname()}-`;
  const target = fs.readlinkSync(lockPath);
  if (!target.startsWith(prefix)) throw locked();
  const pidText = target.slice(prefix.length);
  if (!/^[1-9]\d*$/.test(pidText)) throw locked();
  const pid = Number(pidText);
  if (!Number.isSafeInteger(pid)) throw locked();
  try { process.kill(pid, 0); }
  catch (error) {
    // Chrome handles its own stale lock; never remove profile lock files here.
    if (error.code === "ESRCH") return preparePreferences(directory);
    throw locked();
  }
  throw locked();
}
async function allocatePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
function readVersion(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: "127.0.0.1", port, path: "/json/version",
      timeout: 1000 }, response => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        text += chunk;
        if (text.length > 65536) request.destroy(new Error("Oversized debugger response"));
      });
      response.once("end", () => {
        try {
          if (response.statusCode !== 200) throw new Error("Debugger HTTP request failed");
          resolve(JSON.parse(text));
        } catch (error) { reject(error); }
      });
      response.once("error", reject);
    });
    request.once("timeout", () => request.destroy(new Error("Debugger request timed out")));
    request.once("error", reject);
  });
}
function closeBrowser(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let sent = false;
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Browser.close timed out")), 3000);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.close();
      if (error) reject(error); else resolve();
    }
    ws.addEventListener("open", () => { sent = true; ws.send(JSON.stringify({ id: 1, method: "Browser.close" })); });
    ws.addEventListener("message", event => {
      const result = JSON.parse(event.data);
      if (result.id === 1) finish(result.error ? new Error("Browser.close rejected") : null);
    });
    ws.addEventListener("close", () => { if (sent) finish(); });
    ws.addEventListener("error", () => finish(new Error("Browser.close transport failed")));
  });
}
function debuggerJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: "127.0.0.1", port, path: pathname, timeout: 3000 }, response => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", chunk => {
        text += chunk;
        if (text.length > 4 * 1024 * 1024) request.destroy(new Error("Oversized debugger listing"));
      });
      response.once("end", () => {
        try {
          if (response.statusCode !== 200) throw new Error("Debugger HTTP request failed");
          resolve(JSON.parse(text));
        } catch (error) { reject(error); }
      });
      response.once("error", reject);
    });
    request.once("timeout", () => request.destroy(new Error("Debugger request timed out")));
    request.once("error", reject);
  });
}
function cdpCommand(url, method, params, timeoutMs) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let settled = false;
    const timer = setTimeout(() => finish(new Error(method + " timed out")), timeoutMs);
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (_) { /* already closing */ }
      if (error) reject(error); else resolve(value);
    }
    ws.addEventListener("open", () => ws.send(JSON.stringify({ id: 1, method, params: params || {} })));
    ws.addEventListener("message", event => {
      let message; try { message = JSON.parse(event.data); } catch (_) { return; }
      if (message.id === 1)
        finish(message.error ? new Error(method + " rejected") : null, message.result);
    });
    ws.addEventListener("error", () => finish(new Error(method + " transport failed")));
    ws.addEventListener("close", () => finish(new Error(method + " closed before reply")));
  });
}
async function waitExit(child, milliseconds) {
  const deadline = Date.now() + milliseconds;
  while (alive(child) && Date.now() < deadline) await sleep(25);
  return !alive(child);
}
function bounded(promise, milliseconds, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
// Resolve the unpacked NopeCHA solver to load into the chrome-first launch (r8/r7b parity,
// re-authorised by the artist 2026-11-06). Returns the directory only when it is actually
// shipped in the payload and the operator has not set TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION=1
// (the same env lever the webdriver path honours — instant rollback without reinstalling).
// Loaded as an unpacked extension via --load-extension; verified on CfT 156 to raise no
// developer-mode warning bubble under --disable-infobars.
function captchaExtensionDir(baseDir, env) {
  if (env && env.TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION === "1") return null;
  const dir = path.join(baseDir, "nopecha");
  try { if (fs.statSync(dir).isDirectory()) return dir; } catch (_) { /* not shipped */ }
  return null;
}

class ChromeSession {
  constructor(options, dependencies = {}) {
    this.options = { timeoutMs: 10000, pollMs: 100, ...options };
    this.deps = {
      now: Date.now, sleep, spawn, prepareProfile, allocatePort, inspectEndpoint,
      captchaExtension: () => captchaExtensionDir(__dirname, process.env),
      readVersion, closeBrowser, waitExit, portReleased: port => sockets(port).length === 0,
      createService: driverPath => {
        const { ServiceBuilder } = require("selenium-webdriver/chrome");
        return new ServiceBuilder(driverPath).build();
      },
      connect: (server, address) => {
        const { Builder } = require("selenium-webdriver");
        return new Builder().usingServer(server).withCapabilities({
          browserName: "chrome", unhandledPromptBehavior: "dismiss",
          "goog:chromeOptions": { debuggerAddress: address },
        }).build();
      },
      ...dependencies,
    };
    this.driver = null;
    this.child = null;
    this.service = null;
    this.stopped = false;
  }
  start() {
    if (!this.starting) this.starting = this._start();
    return this.starting;
  }
  // Capture the live page of this window as self-contained MHTML (for the same-day snapshot cache).
  async captureSnapshot() {
    if (!this.port) throw new Error("Chrome session has no debugger port");
    const targets = await debuggerJson(this.port, "/json/list");
    const page = Array.isArray(targets) &&
      targets.find(t => t && t.type === "page" && typeof t.webSocketDebuggerUrl === "string");
    if (!page) throw new Error("No page target available for snapshot");
    const result = await cdpCommand(page.webSocketDebuggerUrl,
      "Page.captureSnapshot", { format: "mhtml" }, 20000);
    if (!result || typeof result.data !== "string" || !result.data.length)
      throw new Error("Empty MHTML snapshot");
    return result.data;
  }
  checkStopped() {
    if (this.stopped) throw new Error("Chrome session stopped during startup");
  }
  async _start() {
    try {
      for (const key of ["chromePath", "driverPath", "profileDir"]) {
        const value = this.options[key];
        if (typeof value !== "string" || !path.isAbsolute(value) || /[\0\r\n]/.test(value))
          throw new Error("Invalid Chrome session path argument");
      }
      this.checkStopped();
      await this.deps.prepareProfile(this.options.profileDir);
      this.checkStopped();
      this.port = await this.deps.allocatePort();
      if (!Number.isSafeInteger(this.port) || this.port <= 1024 || this.port > 65535)
        throw new Error("Invalid allocated debugger port");
      this.checkStopped();
      const launchArgs = [
        "--ozone-platform=x11", "--disable-setuid-sandbox",
        "--no-first-run", "--no-default-browser-check", "--password-store=basic",
        "--hide-crash-restore-bubble", "--disable-infobars",
        "--disable-blink-features=AutomationControlled",
        "--user-data-dir=" + this.options.profileDir,
        "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=" + this.port,
      ];
      for (const extra of this.options.extraArgs || []) {
        if (typeof extra === "string" && extra && !/[\0\r\n]/.test(extra)) launchArgs.push(extra);
      }
      const extensionDir = this.deps.captchaExtension();
      if (typeof extensionDir === "string" && path.isAbsolute(extensionDir) &&
          !/[\0\r\n]/.test(extensionDir)) {
        launchArgs.push("--load-extension=" + extensionDir);
        console.log("captcha-extension loaded " + extensionDir);
      } else {
        console.log("captcha-extension disabled");
      }
      launchArgs.push("--new-window", "about:blank");
      this.child = this.deps.spawn(this.options.chromePath, launchArgs,
        { env: this.options.env || process.env, stdio: ["ignore", "pipe", "pipe"] });
      this.child.once("error", error => { this.spawnError = error; });
      // Do not copy arbitrary Chromium stderr (including debugger URLs) into artwork logs.
      this.child.stdout.resume();
      this.child.stderr.resume();
      const deadline = this.deps.now() + this.options.timeoutMs;
      while (true) {
        this.checkStopped();
        if (this.spawnError) throw this.spawnError;
        if (!alive(this.child)) throw new Error("Owned Chrome exited during startup");
        if (this.deps.now() >= deadline) throw new Error("Chrome debugger startup timed out");
        if (this.deps.inspectEndpoint(this.child, this.port)) {
          try {
            const version = await this.deps.readVersion(this.port);
            this.checkStopped();
            this.debuggerURL = validateDebugger(version.webSocketDebuggerUrl, this.port);
            break;
          } catch (error) {
            if (!["ECONNREFUSED", "ECONNRESET"].includes(error.code)) throw error;
          }
        }
        await this.deps.sleep(this.options.pollMs);
      }
      this.checkStopped();
      this.service = this.deps.createService(this.options.driverPath);
      const address = await this.service.start();
      this.checkStopped();
      this.driver = await this.deps.connect(address, `127.0.0.1:${this.port}`);
      this.checkStopped();
      return this;
    } catch (error) {
      try { await this.cleanup(); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Chrome startup and cleanup failed");
      }
      throw error;
    }
  }
  close() {
    this.stopped = true;
    if (!this.closing) this.closing = (async () => {
      if (this.starting) {
        try { await this.starting; }
        catch (_) { /* Startup already reports its original failure to its caller. */ }
      }
      await this.cleanup();
    })();
    return this.closing;
  }
  cleanup() {
    if (!this.cleaning) this.cleaning = this._cleanup();
    return this.cleaning;
  }
  async _cleanup() {
    const errors = [];
    const attempt = async fn => { try { await fn(); } catch (error) { errors.push(error); } };
    if (this.driver) await attempt(() => bounded(this.driver.quit(), 2500, "Driver quit"));
    if (alive(this.child) && this.debuggerURL) {
      await attempt(async () => {
        if (!this.deps.inspectEndpoint(this.child, this.port))
          throw new Error("Owned debugger disappeared during cleanup");
        await this.deps.closeBrowser(this.debuggerURL);
      });
    }
    if (alive(this.child)) {
      const exited = this.debuggerURL && await this.deps.waitExit(this.child, 1000);
      if (!exited) {
        await attempt(async () => {
          this.child.kill("SIGTERM");
          if (!await this.deps.waitExit(this.child, 2000)) throw new Error("Owned Chrome did not exit");
        });
      }
    }
    if (this.service) await attempt(() => bounded(this.service.kill(), 2000, "Driver service stop"));
    if (this.port) await attempt(() => {
      if (!this.deps.portReleased(this.port)) throw new Error("Debugger port remains occupied");
    });
    if (errors.length) throw new AggregateError(errors, "Chrome session cleanup failed");
  }
}

module.exports = { ChromeSession, validateDebugger, inspectEndpoint, captchaExtensionDir };
