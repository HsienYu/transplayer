const test = require("node:test");
const assert = require("node:assert/strict");
const { SnapshotSeeder } = require("../seeder");

function fakeSession() {
  const s = { started: 0, closed: 0 };
  s.start = async () => { s.started++; };
  s.close = async () => { s.closed++; };
  return s;
}

test("one clean profile captures every query in a single pass", async () => {
  const sessions = [];
  const seeder = new SnapshotSeeder({
    urls: ["a", "b", "c"],
    makeSession: async () => { const s = fakeSession(); sessions.push(s); return s; },
    probe: async () => true,
    maxProfiles: 20,
  });
  const r = await seeder.run();
  assert.deepEqual(r.captured, ["a", "b", "c"]);
  assert.deepEqual(r.incomplete, []);
  assert.equal(r.profiles, 1);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].closed, 1);
});

test("rotates to a fresh profile on a gate; the gated query is retried first", async () => {
  let p = 0;
  const seen = [];
  const seeder = new SnapshotSeeder({
    urls: ["a", "b", "c", "d"],
    makeSession: async () => { p++; return fakeSession(); },
    probe: async (url) => { seen.push(`${p}:${url}`); return !(p === 1 && url === "c"); },
    maxProfiles: 20,
  });
  const r = await seeder.run();
  assert.deepEqual(r.captured, ["a", "b", "c", "d"]);
  assert.deepEqual(r.incomplete, []);
  assert.equal(r.profiles, 2);
  assert.deepEqual(seen, ["1:a", "1:b", "1:c", "2:c", "2:d"]);
});

test("a query that always gates is reported incomplete after the profile budget", async () => {
  let profiles = 0;
  const seeder = new SnapshotSeeder({
    urls: ["x"],
    makeSession: async () => { profiles++; return fakeSession(); },
    probe: async () => false,
    maxProfiles: 5,
  });
  const r = await seeder.run();
  assert.deepEqual(r.captured, []);
  assert.deepEqual(r.incomplete, ["x"]);
  assert.equal(r.profiles, 5);
});

test("every session is closed even when its profile gates", async () => {
  const sessions = [];
  const seeder = new SnapshotSeeder({
    urls: ["a"],
    makeSession: async () => { const s = fakeSession(); sessions.push(s); return s; },
    probe: async () => false,
    maxProfiles: 3,
  });
  await seeder.run();
  assert.equal(sessions.length, 3);
  for (const s of sessions) assert.equal(s.closed, 1);
});

test("a session that fails to start is closed and the run rotates past it", async () => {
  const sessions = [];
  const seeder = new SnapshotSeeder({
    urls: ["a"],
    makeSession: async () => {
      const s = fakeSession();
      s.start = async () => { throw new Error("chrome failed"); };
      sessions.push(s); return s;
    },
    probe: async () => true,
    maxProfiles: 2,
  });
  const r = await seeder.run();
  assert.deepEqual(r.incomplete, ["a"]);
  assert.equal(sessions.length, 2);
  for (const s of sessions) assert.equal(s.closed, 1);
});

const { ScheduledRefresh, captureQuality } = require('../seeder');
test('scheduled refresh runs immediately, waits after completion, and cancels on stop', async () => {
  let finish, runs = 0, pending, cancelled = false;
  const job = new ScheduledRefresh({ run: () => { runs++; return new Promise(r => { finish = r; }); },
    intervalMs: 3600000, schedule: (fn, ms) => { pending = { fn, ms }; return 1; },
    cancel: () => { cancelled = true; } });
  const first = job.start();
  assert.equal(runs, 1);
  await job.start();
  assert.equal(runs, 1);
  assert.equal(pending, undefined);
  finish(); await first;
  assert.equal(pending.ms, 3600000);
  job.stop(); assert.equal(cancelled, true);
  await pending.fn(); assert.equal(runs, 1);
});
test('failed refresh is logged and delayed instead of immediately retried', async () => {
  const logs = []; let delay;
  const job = new ScheduledRefresh({ run: async () => { throw Error('offline'); },
    schedule: (_, ms) => { delay = ms; }, log: m => logs.push(m) });
  await job.start();
  assert.equal(delay, 3600000); assert.match(logs[0], /offline/);
  job.stop();
});
test('capture quality rejects gates, grey thumbnails, shallow and malformed pages', () => {
  const good = { loaded: 240, pending: 0, height: 15000, bottom: 14500, gated: false };
  assert.equal(captureQuality(good), true);
  for (const patch of [{ gated: true }, { pending: 1 }, { loaded: 25 }, { height: 5000 },
    { bottom: 5000 }, { loaded: NaN }, { pending: -1 }])
    assert.equal(captureQuality({ ...good, ...patch }), false);
  assert.equal(captureQuality(null), false);
});
test('scheduled pass attempts later queries after a gate without rotating profiles', async () => {
  const seen = [];
  const seeder = new SnapshotSeeder({ urls: ['a', 'b', 'c'], retryGated: false,
    makeSession: async () => fakeSession(), probe: async url => { seen.push(url); return url !== 'b'; } });
  const result = await seeder.run();
  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.deepEqual(result.captured, ['a', 'c']);
  assert.deepEqual(result.incomplete, ['b']);
  assert.equal(result.profiles, 1);
});

const { snapshotArtifactQuality } = require('../seeder');
function archive(parts) {
  return 'MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="test-boundary"\r\n\r\n' +
    parts.map(([encoding,body]) => '--test-boundary\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: '+encoding+'\r\n\r\n'+body+'\r\n').join('')+'--test-boundary--\r\n';
}
test('artifact checks inspect encoded nested frames, not only the clean parent page', () => {
  const clean='<html><body><img src="cid:photo">Results</body></html>';
  assert.equal(snapshotArtifactQuality(archive([['8bit',clean]])).clean,true);
  for (const [encoding,body] of [
    ['base64',Buffer.from('<body>Our systems have detected unusual traffic</body>').toString('base64')],
    ['quoted-printable',"<body>I'm not a =72obot</body>"],
    ['8bit','<body>我不是機器人</body>']]) {
    const result=snapshotArtifactQuality(archive([['8bit',clean],[encoding,body]]));
    assert.equal(result.clean,false); assert.equal(result.reason,'challenge');
  }
  assert.equal(snapshotArtifactQuality('not a MIME archive').clean,false);
});
test('script text alone is not a visible challenge but missing parser never accepts input', () => {
  assert.equal(snapshotArtifactQuality(archive([['8bit','<body><script>"unusual traffic"</script>Results</body>']])).clean,true);
});
test('scene depth uses that query scroll and viewport, without weakening image checks', () => {
  const s={loaded:100,pending:0,height:11000,bottom:10900,gated:false,viewportHeight:1620};
  assert.equal(captureQuality(s,{scroll:9000,height:1620}),true);
  assert.equal(captureQuality(s,{scroll:12000,height:1964}),false);
  assert.equal(captureQuality({...s,pending:1},{scroll:9000,height:1620}),false);
});
test('artifact rejects a challenge iframe even when its remote contents are missing', () => {
  for(const body of ['<iframe src="https://www.google.com/sorry/index"></iframe>',
    '<iframe srcdoc="&lt;p&gt;unusual traffic&lt;/p&gt;"></iframe>']) {
    assert.equal(snapshotArtifactQuality(archive([['8bit','<body>'+body+'</body>']])).clean,false);
  }
});
test('solver grace waits for clean results and stops at its deadline', async () => {
  const {waitForClean}=require('../seeder');
  let time=0,checks=0;
  assert.equal(await waitForClean({check:async()=>++checks===3,timeoutMs:30,pollMs:10,now:()=>time,sleep:async ms=>{time+=ms;}}),true);
  assert.equal(time,20);
  time=0;
  assert.equal(await waitForClean({check:async()=>false,timeoutMs:30,pollMs:10,now:()=>time,sleep:async ms=>{time+=ms;}}),false);
  assert.equal(time,30);
  assert.equal(await waitForClean({check:async()=>{throw Error('unavailable')},timeoutMs:0}),false);
});
