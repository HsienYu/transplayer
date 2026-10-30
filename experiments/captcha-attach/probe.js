// Prototype only. No production controller imports or browser-state extraction.
const assert = require("assert");
const fs = require("fs");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");
const root = "/opt/transplayer/releases/r8.AppDir";
const { Builder } = require(root + "/app/node_modules/selenium-webdriver");
const { ServiceBuilder } = require(root + "/app/node_modules/selenium-webdriver/chrome");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stamp = new Date().toISOString().replace(/[-:.]/g, "");
const stage = path.join(process.env.HOME, "Documents/transplayer-staging/r8-20261030T131505Z");
const profile = path.join(stage, "attach-profile-" + stamp);
const metrics = `JSON.stringify({
 host:location.hostname,path:location.pathname,images:document.images.length,
 loaded:[...document.images].filter(i=>i.complete&&i.naturalWidth>80).length,
 y:pageYOffset,maxY:Math.max(0,document.documentElement.scrollHeight-innerHeight),
 recaptcha:!!document.querySelector('iframe[src*="recaptcha"],.g-recaptcha,#recaptcha'),
 sorry:location.pathname.startsWith('/sorry/')
})`;

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { ws.close(); reject(Error("CDP open timeout")); }, 5000);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener("error", () => { clearTimeout(timer); reject(Error("CDP open failed")); }, { once: true });
    });
    return new CDP(ws);
  }
  call(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error("CDP timeout: " + method)); }, 5000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws.close(); }
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function listeners(port) {
  const hex = port.toString(16).toUpperCase().padStart(4, "0");
  return ["/proc/net/tcp", "/proc/net/tcp6"].flatMap(file =>
    fs.readFileSync(file, "utf8").trim().split("\n").slice(1)
      .map(line => line.trim().split(/\s+/))
      .filter(fields => fields[1].split(":")[1] === hex && fields[3] === "0A")
      .map(fields => fields[1].split(":")[0]));
}
async function getJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  assert(response.ok);
  return response.json();
}
let chrome, browserCDP, pageCDP, driver, port, chromeLog;
const observations = [];
async function record(label, read) {
  const value = await read();
  observations.push({ label, ...value });
  console.log(label, JSON.stringify(value));
  return value;
}
async function main() {
  assert.equal(typeof WebSocket, "function");
  assert.equal(listeners(8080).length, 0, "Player already active");
  fs.mkdirSync(profile, { mode: 0o700 });
  port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  chromeLog = fs.openSync(path.join(stage, "attach-chrome-" + stamp + ".log"), "wx", 0o600);
  chrome = spawn(root + "/browser/chrome", [
    "--ozone-platform=x11", "--disable-setuid-sandbox",
    "--no-first-run", "--no-default-browser-check", "--user-data-dir=" + profile,
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=" + port,
    "--new-window", "--window-position=0,0", "--window-size=1080,1600",
    "https://www.google.com/search?q=world+news&tbm=isch",
  ], { stdio: ["ignore", chromeLog, chromeLog] });
  let version;
  for (let i = 0; i < 30; i++) {
    if (chrome.exitCode !== null) throw Error("Chrome exited before CDP readiness");
    try { version = await getJSON(base + "/json/version"); break; }
    catch (error) { if (i === 29) throw error; await sleep(200); }
  }
  const addresses = listeners(port);
  assert(addresses.length > 0 && addresses.every(a => a === "0100007F"), "Debugger must bind loopback only");
  console.log("CDP_LOOPBACK_ONLY_PASS", version.Browser);
  browserCDP = await CDP.connect(version.webSocketDebuggerUrl);
  const targets = await getJSON(base + "/json/list");
  const page = targets.find(target => target.type === "page");
  assert(page);
  pageCDP = await CDP.connect(page.webSocketDebuggerUrl);
  const cdpRead = async () => {
    const result = await pageCDP.call("Runtime.evaluate", { expression: metrics, returnByValue: true });
    assert(!result.exceptionDetails);
    return JSON.parse(result.result.value);
  };
  for (let i = 0; i < 2; i++) {
    await sleep(5000);
    await record("BEFORE_WEBDRIVER_ATTACH", cdpRead);
  }
  driver = await new Builder().withCapabilities({
    browserName: "chrome", "goog:chromeOptions": { debuggerAddress: `127.0.0.1:${port}` },
  }).setChromeService(new ServiceBuilder(root + "/app/bin/chrome/chromedriver")).build();
  await driver.manage().setTimeouts({ pageLoad: 20000, script: 10000 });
  const wdRead = async () => JSON.parse(await driver.executeScript("return " + metrics));
  await record("AFTER_ATTACH_NO_NAVIGATION", wdRead);
  try {
    await driver.manage().window().setRect({ x: 0, y: 0, width: 1080, height: 1920 });
    console.log("ATTACHED_WINDOW_RECT", JSON.stringify(await driver.manage().window().getRect()));
  } catch (error) {
    console.error("ATTACHED_WINDOW_OPERATION_FAILED\n" + error.stack);
  }
  await driver.navigate().refresh();
  let last;
  for (let i = 0; i < 3; i++) {
    await sleep(5000);
    last = await record("AFTER_ATTACH_REFRESH", wdRead);
    if (last.loaded > 0 && last.maxY > 0 && !last.sorry && !last.recaptcha)
      await driver.executeScript("window.scrollBy(0,400)");
  }
  if (last.loaded > 0 && !last.sorry && !last.recaptcha) {
    await driver.get("https://www.google.com/search?q=elephant&tbm=isch");
    await sleep(5000);
    last = await record("SECOND_SEARCH_ATTACHED", wdRead);
    if (last.maxY > 0 && !last.sorry && !last.recaptcha) {
      await driver.executeScript("window.scrollBy(0,400)");
      await sleep(1000);
      await record("SECOND_SEARCH_SCROLL", wdRead);
    }
  }
  const images = observations.some(v => v.loaded > 0 && !v.sorry && !v.recaptcha);
  const scroll = observations.some(v => v.y > 0 && v.loaded > 0 && !v.sorry && !v.recaptcha);
  console.log("ATTACH_EXPERIMENT_RESULT", JSON.stringify({ images, scroll,
    challengeSamples: observations.filter(v => v.sorry || v.recaptcha).length }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  try {
    if (driver) await driver.quit();
    if (chrome && chrome.exitCode === null && browserCDP) {
      try { await browserCDP.call("Browser.close"); }
      catch (error) { if (chrome.exitCode === null) console.error(error.message); }
      for (let i = 0; i < 50 && chrome.exitCode === null; i++) await sleep(100);
    }
    if (chrome && chrome.exitCode === null) {
      console.error("Chrome did not close through CDP; stopping owned child");
      chrome.kill("SIGTERM");
      process.exitCode = 1;
      await new Promise(resolve => chrome.once("exit", resolve));
    }
    pageCDP?.close();
    browserCDP?.close();
    if (chromeLog !== undefined) fs.closeSync(chromeLog);
    assert(!port || listeners(port).length === 0);
    console.log("ATTACH_EXPERIMENT_CLEANUP_PASS profile_preserved");
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
});
