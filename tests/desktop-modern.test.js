const test = require("node:test");
const assert = require("node:assert/strict");

const executable = "/opt/transplayer/releases/r8.AppDir/runtime/electron";
const appDir = "/opt/transplayer/releases/r8.AppDir/app";
const load = () => import("../packaging/gnome49/lease.mjs");

function fixture() {
  const callbacks = new Map();
  const panel = {
    visible: true,
    hide() { this.visible = false; },
    connect(signal, fn) { callbacks.set(1, fn); return 1; },
    disconnect(id) { callbacks.delete(id); },
  };
  const target = {
    _handledWindow(actor) { return !!actor.get_meta_window(); },
    forceUpdate() {},
  };
  const chain = [
    { pid: 300, ppid: 200, uid: 1000 },
    { pid: 200, ppid: 100, uid: 1000, exe: executable,
      secureExecutable: true, args: [executable, `${appDir}/desktop-modern-guard.js`] },
    { pid: 100, ppid: 1, uid: 1000, exe: executable,
      secureExecutable: true, args: [executable, appDir] },
  ];
  return { panel, callbacks, target, chain,
    options: { panel, docks: [{ _intellihide: target }], uid: 1000, executable, appDir } };
}

test("modern lease hides the panel and excludes only the verified overlay PID", async () => {
  const { DesktopLease } = await load();
  const f = fixture(), original = f.target._handledWindow;
  const lease = new DesktopLease(f.options);
  lease.acquire(":1.20", 100, "owner-1", f.chain);
  assert.equal(f.panel.visible, false);
  assert.equal(f.target._handledWindow({ get_meta_window: () => ({ get_pid: () => 100 }) }), false);
  assert.equal(f.target._handledWindow({ get_meta_window: () => ({ get_pid: () => 999 }) }), true);
  lease.release(":1.20", "owner-1");
  assert.equal(f.panel.visible, true);
  assert.equal(f.target._handledWindow, original);
  assert.equal(f.callbacks.size, 0);
});

test("lease obtains live docks after boot instead of retaining an empty startup snapshot", async () => {
  const { DesktopLease } = await load();
  const f = fixture();
  let current = [];
  const lease = new DesktopLease({ ...f.options, docks: [], getDocks: () => current });
  assert.throws(() => lease.acquire(":1.20", 100, "owner", f.chain), /dock/i);
  assert.equal(f.panel.visible, true);
  current = f.options.docks;
  const original = f.target._handledWindow;
  lease.acquire(":1.20", 100, "owner", f.chain);
  assert.equal(f.panel.visible, false);
  assert.notEqual(f.target._handledWindow, original);
  lease.release(":1.20", "owner");
  assert.equal(f.target._handledWindow, original);
});

test("a replaced dock is used on the next lease and only its own hooks are restored", async () => {
  const { DesktopLease } = await load();
  const a = fixture(), b = fixture();
  let current = a.options.docks;
  const lease = new DesktopLease({ ...a.options, getDocks: () => current });
  const oldA = a.target._handledWindow, oldB = b.target._handledWindow;
  lease.acquire(":1.20", 100, "owner", a.chain);
  lease.release(":1.20", "owner");
  current = b.options.docks;
  lease.acquire(":1.20", 100, "owner", a.chain);
  assert.equal(a.target._handledWindow, oldA);
  assert.notEqual(b.target._handledWindow, oldB);
  lease.disable();
  assert.equal(b.target._handledWindow, oldB);
});

test("missing live docks fail closed instead of using stale docks", async () => {
  const { DesktopLease } = await load();
  const f = fixture();
  const lease = new DesktopLease({ ...f.options, getDocks: () => [] });
  assert.throws(() => lease.acquire(":1.20", 100, "owner", f.chain), /dock/i);
  assert.equal(f.panel.visible, true);
  assert.equal(f.callbacks.size, 0);
});

test("release allowlist admits r9 with matching guard and app, retaining r8", async () => {
  const { DesktopLease, RELEASES } = await load();
  assert.deepEqual(RELEASES.map(r => r.version), ["r8", "r9"]);
  for (const release of RELEASES) {
    const f = fixture();
    f.options.targets = RELEASES;
    for (const index of [1, 2]) f.chain[index].exe = release.executable;
    f.chain[1].args = [release.executable, `${release.appDir}/desktop-modern-guard.js`];
    f.chain[2].args = [`${release.executable} --ozone-platform=x11 --enable-transparent-visuals --disable-setuid-sandbox ${release.appDir}`, ""];
    const lease = new DesktopLease(f.options);
    lease.acquire(":1.20", 100, "owner-1", f.chain);
    assert.equal(f.panel.visible, false);
    lease.release(":1.20", "owner-1");
  }
});

test("release allowlist rejects mixed versions and unapproved root lookalikes", async () => {
  const { DesktopLease, RELEASES } = await load();
  assert(RELEASES);
  for (const change of [
    f => { f.chain[1].exe = "/opt/transplayer/releases/r9.AppDir/runtime/electron"; },
    f => { f.chain[2].args[1] = "/opt/transplayer/releases/r9.AppDir/app"; },
    f => {
      for (const index of [1, 2]) f.chain[index].exe = "/opt/transplayer/releases/r90.AppDir/runtime/electron";
    },
  ]) {
    const f = fixture(); change(f);
    const lease = new DesktopLease({ ...f.options, targets: RELEASES });
    assert.throws(() => lease.acquire(":1.20", 100, "owner-1", f.chain), /identity/i);
    assert.equal(f.panel.visible, true);
  }
});

test("forged PID, UID, ancestry, executable or script cannot mutate desktop", async () => {
  const { DesktopLease } = await load();
  for (const mutate of [
    f => { f.chain[2].pid = 999; },
    f => { f.chain[0].uid = 0; },
    f => { f.chain[1].ppid = 999; },
    f => { f.chain[1].exe = "/tmp/electron"; },
    f => { f.chain[2].secureExecutable = false; },
    f => { f.chain[1].args[1] = `${appDir}/lookalike.js`; },
    f => { f.chain[2].args[1] = "/tmp/app"; },
  ]) {
    const f = fixture(); mutate(f);
    const lease = new DesktopLease(f.options);
    assert.throws(() => lease.acquire(":1.20", 100, "owner-1", f.chain), /identity/i);
    assert.equal(f.panel.visible, true);
    assert.equal(f.callbacks.size, 0);
  }
});

test("Electron45 canonical rewritten process title retains exact player identity", async () => {
  const { DesktopLease } = await load();
  const f = fixture();
  f.chain[2].args = [`${executable} --ozone-platform=x11 --enable-transparent-visuals --disable-setuid-sandbox ${appDir}`, "", ""];
  const lease = new DesktopLease(f.options);
  lease.acquire(":1.20", 100, "owner-1", f.chain);
  assert.equal(f.panel.visible, false);
  lease.release(":1.20", "owner-1");
  assert.equal(f.panel.visible, true);
});

test("rewritten process title rejects lookalike paths, flags and hidden arguments", async () => {
  const { DesktopLease } = await load();
  const title = `${executable} --ozone-platform=x11 --enable-transparent-visuals --disable-setuid-sandbox ${appDir}`;
  for (const args of [
    [title + "-forged", ""], [title.replace("--ozone-platform=x11", "--no-sandbox"), ""],
    [title, "", "--injected"], [title.replace(executable, "/tmp/electron"), ""],
    [title.replace(appDir, "/tmp/app"), ""],
  ]) {
    const f = fixture();
    f.chain[2].args = args;
    const lease = new DesktopLease(f.options);
    assert.throws(() => lease.acquire(":1.20", 100, "owner-1", f.chain), /identity/i);
    assert.equal(f.panel.visible, true);
  }
});
test("invalid protocol fields and zero PID are rejected before mutation", async () => {
  const { DesktopLease } = await load();
  for (const [sender, pid, owner] of [
    ["not-a-bus-name", 100, "owner"], [":1.20", 0, "owner"],
    [":1.20", 100, ""], [":1.20", 100, "bad();code"], [":1.20", 100, "x".repeat(129)],
  ]) {
    const f = fixture(), lease = new DesktopLease(f.options);
    assert.throws(() => lease.acquire(sender, pid, owner, f.chain), /invalid/i);
    assert.equal(f.panel.visible, true);
  }
});

test("duplicate acquisition and foreign release preserve the original lease", async () => {
  const { DesktopLease } = await load();
  const f = fixture(), lease = new DesktopLease(f.options);
  lease.acquire(":1.20", 100, "owner-1", f.chain);
  assert.throws(() => lease.acquire(":1.21", 100, "owner-2", f.chain), /owned/i);
  assert.throws(() => lease.release(":1.21", "owner-1"), /owner/i);
  assert.throws(() => lease.release(":1.20", "owner-2"), /owner/i);
  assert.equal(f.panel.visible, false);
  lease.release(":1.20", "owner-1");
});

test("only the owning connection disappearing restores the desktop", async () => {
  const { DesktopLease } = await load();
  const f = fixture(), lease = new DesktopLease(f.options);
  lease.acquire(":1.20", 100, "owner-1", f.chain);
  lease.disconnect(":1.21");
  assert.equal(f.panel.visible, false);
  lease.disconnect(":1.20");
  assert.equal(f.panel.visible, true);
  lease.disable();
});

test("extension disable restores originally hidden panel and removes hooks", async () => {
  const { DesktopLease } = await load();
  const f = fixture(); f.panel.visible = false;
  const original = f.target._handledWindow;
  const lease = new DesktopLease(f.options);
  lease.acquire(":1.20", 100, "owner-1", f.chain);
  lease.disable();
  assert.equal(f.panel.visible, false);
  assert.equal(f.target._handledWindow, original);
  assert.equal(f.callbacks.size, 0);
});

test("missing Dock API and partial hook failure restore all mutated state", async () => {
  const { DesktopLease } = await load();
  const f = fixture(), original = f.target._handledWindow;
  const bad = new DesktopLease({ ...f.options, docks: [{ _intellihide: {} }] });
  assert.throws(() => bad.acquire(":1.20", 100, "owner", f.chain), /dock/i);
  assert.equal(f.panel.visible, true);
  let first = true;
  f.target.forceUpdate = () => { if (first) { first = false; throw Error("update failed"); } };
  const lease = new DesktopLease(f.options);
  assert.throws(() => lease.acquire(":1.20", 100, "owner", f.chain), /update failed/);
  assert.equal(f.panel.visible, true);
  assert.equal(f.target._handledWindow, original);
  assert.equal(f.callbacks.size, 0);
});
