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
