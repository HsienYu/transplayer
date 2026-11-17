const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function timeline(env = {}) {
  const calls = [];
  class Controller { profileRoot() { return "/synthetic/profiles"; } }
  for (const name of ["goTo", "setBrowserRect", "scrollTo", "breakScroll", "closeBrowser", "closeAllBrowser"]) {
    Controller.prototype[name] = async (...args) => {
      calls.push(JSON.parse(JSON.stringify([name, ...args])));
      return true;
    };
  }
  const handlers = {};
  const sandbox = {
    module: { exports: {} }, console, setTimeout, setInterval: () => ({ unref() {} }), clearInterval: () => {}, __dirname: "/synthetic",
    process: { env, on: (name, fn) => { handlers[name] = fn; }, exit: code => calls.push(["exit", code]) },
    require(name) {
      if (name === "./controller") return Controller;
      if (name === "os") return { homedir: () => "/synthetic" };
      if (name === "path") return path;
      if (name === "./nopecha-settings") return { prepareNopecha: () => {
        calls.push(["prepareSolver"]);
        return { directory: env.TEST_SOLVER === "1" ? "/synthetic/solver" : null,
          cleanup: () => calls.push(["cleanupSolver"]) };
      } };
      if (name === "./seeder") return { startRefreshWorker: () => {
        calls.push(["refresh"]); return async () => calls.push(["stopRefresh"]);
      } };
      if (name === "selenium-webdriver") return {};
      if (name === "events") return { EventEmitter: { defaultMaxListeners: 10 } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "../web-process-new.js"), "utf8");
  vm.runInNewContext(source + "\nmodule.exports = { task, callTask, controller };", sandbox);
  return { ...sandbox.module.exports, calls, handlers };
}

const searches = [
  [10, 14, "elephant news", "qdr:y"],
  [65, 13, "map of melaka fort"],
  [120, 15, "Telecom tower"],
  [140, 13, "starlink"],
  [230, 16, "pawang"],
  [280, 13, "elephant in keddah"],
  [320, 17, "elephant attack"],
  [350, 13, "elephant bone "],
  [440, 18, "history and ethnography museum"],
  [450, 13, "history gunpowder"],
  [580, 19, "gunpowder explosion"],
  [610, 13, "explosion news"],
  [775, 13, "world news", "qdr:d"],
];

test("all live searches use Google images with the exact original terms", async () => {
  const t = timeline();
  for (const [second, id, query] of searches) {
    t.calls.length = 0;
    await t.callTask(second);
    const calls = t.calls.filter(c => c[0] === "goTo");
    assert.equal(calls.length, 1, `search count at ${second}`);
    assert.equal(calls[0][1], id);
    const url = new URL(calls[0][2]);
    assert.equal(url.origin, "https://www.google.com", `engine at ${second}`);
    assert.equal(url.pathname, "/search");
    assert.equal(url.searchParams.get("q"), query, `query at ${second}`);
    assert.equal(url.searchParams.get("tbm"), "isch");
    assert(!url.username && !url.password && !url.hash);
    assert([...url.searchParams.keys()].every(k => ["q", "tbm", "tbs"].includes(k)));
  }
});

test("image date filters retain the original year and day restrictions", async () => {
  const t = timeline();
  for (const [second, , , filter] of searches) {
    t.calls.length = 0;
    await t.callTask(second);
    const url = new URL(t.calls.find(c => c[0] === "goTo")[2]);
    assert.equal(url.searchParams.get("tbs"), filter || null, `date filter at ${second}`);
  }
});

test("all event times, rectangles, scrolling and browser lifecycles remain unchanged", async () => {
  const t = timeline();
  const expected = {
    10: [["goTo", 14], ["setBrowserRect", 14, { x: 500, y: 180, width: 1620, height: 1620 }], ["scrollTo", 14, 9000]],
    65: [["breakScroll", 13], ["goTo", 13], ["setBrowserRect", 13, { x: -22, y: -19, width: 2204, height: 1964 }], ["scrollTo", 13, 9000]],
    85: [["breakScroll", 14], ["closeBrowser", 14]],
    120: [["goTo", 15], ["setBrowserRect", 15, { x: 500, y: 100, width: 1620, height: 1620 }], ["scrollTo", 15, 9000]],
    140: [["breakScroll", 13], ["goTo", 13], ["scrollTo", 13, 9000]],
    190: [["breakScroll", 15], ["closeBrowser", 15]],
    230: [["goTo", 16], ["setBrowserRect", 16, { x: 400, y: 50, width: 1670, height: 1750 }], ["scrollTo", 16, 9000]],
    280: [["breakScroll", 13], ["goTo", 13], ["scrollTo", 13, 9000]],
    290: [["breakScroll", 16], ["closeBrowser", 16]],
    320: [["goTo", 17], ["setBrowserRect", 17, { x: 30, y: 50, width: 1930, height: 1800 }], ["scrollTo", 17, 9000]],
    350: [["breakScroll", 13], ["goTo", 13], ["scrollTo", 13, 9000]],
    410: [["breakScroll", 17], ["closeBrowser", 17]],
    440: [["goTo", 18], ["setBrowserRect", 18, { x: 30, y: 50, width: 1830, height: 1800 }], ["scrollTo", 18, 9000]],
    450: [["breakScroll", 13], ["goTo", 13], ["scrollTo", 13, 12000]],
    500: [["breakScroll", 18], ["closeBrowser", 18]],
    580: [["goTo", 19], ["setBrowserRect", 19, { x: 30, y: 300, width: 2100, height: 1600 }], ["scrollTo", 19, 9000]],
    610: [["breakScroll", 13], ["goTo", 13], ["scrollTo", 13, 12000]],
    640: [["breakScroll", 19], ["closeBrowser", 19]],
    775: [["goTo", 13], ["setBrowserRect", 13, { x: -22, y: -19, width: 2204, height: 1964 }], ["scrollTo", 13, 9000]],
  };
  assert.deepEqual(Object.keys(t.task), Object.keys(expected));
  for (const second of Object.keys(expected)) {
    t.calls.length = 0;
    await t.callTask(second);
    assert.deepEqual(t.calls.map(c => c[0] === "goTo" ? c.slice(0, 2) : c), expected[second], `actions at ${second}`);
  }
  assert.equal(t.controller.SCROLL_GAP, 1);
  assert.equal(t.controller.SCROLL_INTERVAL, 10);
});

test("the subsequent 775-second event retains its cleanup and live search", async () => {
  const t = timeline();
  await t.callTask(775);
  t.calls.length = 0;
  await t.callTask(775);
  assert.deepEqual(t.calls.map(c => c[0] === "goTo" ? c.slice(0, 2) : c), [
    ["breakScroll", 19], ["closeBrowser", 19], ["goTo", 13], ["scrollTo", 13, 9000],
  ]);
  const url = new URL(t.calls[2][2]);
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("q"), "world news");
  assert.equal(url.searchParams.get("tbs"), "qdr:d");
});

test("non-event seconds do not trigger additional searches", async () => {
  const t = timeline();
  for (const second of [0, 9, 11, 64, 776, 779]) await t.callTask(second);
  assert.deepEqual(t.calls, []);
});

test("stop closes owned browsers once and ignores later timecodes", async () => {
  const t = timeline();
  t.handlers.message({ stop: true });
  await new Promise(resolve => setImmediate(resolve));
  t.handlers.message({ currentTime: 10 });
  await t.handlers.SIGTERM();
  assert.deepEqual(t.calls, [["closeAllBrowser"], ["exit", 0]]);
});

for (const only of ["0", "1"]) for (const solver of ["0", "1"]) {
  test(`independent timeline startup: snapshots=${only}, solver=${solver}`, async () => {
    const env = { TRANSPLAYER_VALIDATED_SNAPSHOTS: "1", TRANSPLAYER_SNAPSHOT_ONLY: only,
      TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION: "1", TEST_SOLVER: solver };
    const t = timeline(env);
    assert.equal(t.calls.filter(c => c[0] === "refresh").length, 1);
    assert.equal(t.calls.some(c => c[0] === "prepareSolver"), only === "0");
    assert.equal(env.TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION, only === "0" && solver === "1" ? "0" : "1");
    await t.handlers.SIGTERM();
    assert(t.calls.some(c => c[0] === "stopRefresh"));
    assert.equal(t.calls.some(c => c[0] === "cleanupSolver"), only === "0");
  });
}

test('every query capture requirement matches the actual timeline rectangle and scroll', async () => {
  const queries=require('../queries');const t=timeline();const rectangles={};
  for(const [second] of searches){
    t.calls.length=0;await t.callTask(second);
    for(const call of t.calls)if(call[0]==='setBrowserRect')rectangles[call[1]]=call[2];
    const nav=t.calls.find(c=>c[0]==='goTo'),scroll=t.calls.find(c=>c[0]==='scrollTo');
    const expected=rectangles[nav[1]];
    assert.deepEqual(queries.requirements[queries.indexOf(nav[2])],{width:expected.width,height:expected.height,scroll:scroll[2]});
  }
});
