const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const launcher = path.join(root, "packaging/pm2-launch.sh");

function fixture(t, ready = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-pm2-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  const write = (name, body) => fs.writeFileSync(path.join(bin, name), "#!/bin/sh\n" + body, { mode: 0o755 });
  write("timeout", 'shift\nexec "$@"\n');
  write("xset", 'test -f "$FIXTURE/ready"\n');
  write("gdbus", 'printf "%s\\n" "(\'{\\"revision\\":2,\\"active\\":false,\\"panelVisible\\":true,\\"dockSlides\\":[1]}\',)"\n');
  write("sleep", 'printf waited > "$FIXTURE/waited"\nprintf ready > "$FIXTURE/ready"\n');
  const image = path.join(dir, "Fake AppImage");
  fs.writeFileSync(image, '#!/bin/sh\nprintf launched > "$FIXTURE/launched"\n', { mode: 0o755 });
  const authority = path.join(dir, "Xauthority");
  fs.writeFileSync(authority, "");
  if (ready) fs.writeFileSync(path.join(dir, "ready"), "");
  return { dir, bin, image, authority, env: {
    ...process.env, PATH: bin, FIXTURE: dir, DISPLAY: ":55",
    XAUTHORITY: authority, XDG_RUNTIME_DIR: dir,
    DBUS_SESSION_BUS_ADDRESS: "unix:path=" + path.join(dir, "bus"),
    TRANSPLAYER_READY_ATTEMPTS: "2",
  } };
}

test("PM2 uses one forked shell launcher and permits graceful cleanup", () => {
  const { apps } = require("../ecosystem.config.js");
  assert.equal(apps.length, 1);
  const app = apps[0];
  assert.equal(app.name, "transplayer");
  assert.equal(app.exec_mode, "fork");
  assert.equal(app.instances, 1);
  assert.equal(app.interpreter, "/bin/sh");
  assert.equal(app.script, launcher);
  assert(app.kill_timeout >= 15000);
  assert(app.restart_delay >= 5000);
  // PM2 7.1.1 can report code 0 even on SIGKILL; exempting zero
  // suppresses the crash recovery required for an unattended exhibit.
  assert.deepEqual(app.stop_exit_codes, [78]);
  assert.equal(app.watch, false);
  assert.equal(app.env.TRANSPLAYER_NONINTERACTIVE, "1");
  assert(app.env.DBUS_SESSION_BUS_ADDRESS.startsWith("unix:path="));
  assert.deepEqual(app.args, ["/opt/transplayer/releases/r9.AppDir/AppRun"]);
});
test("PM2 config does not invent a display or Xauthority before login", t => {
  const f = fixture(t);
  const env = { ...process.env, HOME: f.dir };
  delete env.DISPLAY;
  delete env.XAUTHORITY;
  const result = spawnSync(process.execPath, ["-e",
    `const app=require(${JSON.stringify(path.join(root, "ecosystem.config.js"))}).apps[0];
     console.log(JSON.stringify({display:app.env.DISPLAY,authority:app.env.XAUTHORITY,args:app.args}));`],
  { env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.display, undefined);
  assert.equal(parsed.authority, undefined);
  assert.deepEqual(parsed.args, ["/opt/transplayer/releases/r9.AppDir/AppRun"]);
});

test("waits for X11 before executing an AppImage whose path contains spaces", t => {
  const f = fixture(t);
  const result = spawnSync("/bin/sh", [launcher, f.image], { env: f.env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 0, result.stderr);
  assert(fs.existsSync(path.join(f.dir, "waited")));
  assert(fs.existsSync(path.join(f.dir, "launched")));
});

test("check-only verifies readiness without starting playback", t => {
  const f = fixture(t, true);
  const result = spawnSync("/bin/sh", [launcher, f.image, "--check"], { env: f.env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DESKTOP_READY/);
  assert(!fs.existsSync(path.join(f.dir, "launched")));
});

test("a missing AppImage exits with non-restarting configuration error", t => {
  const f = fixture(t, true);
  const result = spawnSync("/bin/sh", [launcher, path.join(f.dir, "missing")], { env: f.env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 78);
  assert.match(result.stderr, /AppImage/);
  assert(!fs.existsSync(path.join(f.dir, "launched")));
});

test("a running X server alone is insufficient; wait for GNOME Shell too", t => {
  const f = fixture(t, true);
  fs.writeFileSync(path.join(f.bin, "gdbus"),
    '#!/bin/sh\nif test -f "$FIXTURE/waited"; then printf "%s\\n" "(\'{\\"revision\\":2,\\"active\\":false,\\"panelVisible\\":true,\\"dockSlides\\":[1]}\',)"; else printf "%s\\n" "(\'{\\"revision\\":1,\\"active\\":false,\\"panelVisible\\":true}\',)"; fi\n',
    { mode: 0o755 });
  const result = spawnSync("/bin/sh", [launcher, f.image], { env: f.env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 0, result.stderr);
  assert(fs.existsSync(path.join(f.dir, "waited")));
  assert(fs.existsSync(path.join(f.dir, "launched")));
});

test("GNOME 49 uses the restricted Status endpoint, never Eval", t => {
  const f = fixture(t, true);
  fs.writeFileSync(path.join(f.bin, "gdbus"),
    '#!/bin/sh\nprintf "%s\\n" "$*" > "$FIXTURE/gdbus-args"\nprintf "%s\\n" "(\'{\\"revision\\":2,\\"active\\":false,\\"panelVisible\\":true}\',)"\n',
    { mode: 0o755 });
  const result = spawnSync("/bin/sh", [launcher, f.image, "--check"],
    { env: f.env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 0, result.stderr);
  const command = fs.readFileSync(path.join(f.dir, "gdbus-args"), "utf8");
  assert.match(command, /org\.transplayer\.Desktop\.Status/);
  assert.doesNotMatch(command, /Eval/);
  assert(!fs.existsSync(path.join(f.dir, "launched")));
});

for (const [name, response] of [
  ["stale revision", "(\'{\"revision\":1,\"active\":false,\"panelVisible\":true}\',)"],
  ["occupied desktop lease", "(\'{\"revision\":2,\"active\":true,\"panelVisible\":false}\',)"],
  ["missing desktop object", "error: unknown object"],
]) {
  test("PM2 refuses " + name + " after a bounded number of attempts", t => {
    const f = fixture(t, true);
    fs.writeFileSync(path.join(f.bin, "gdbus"),
      "#!/bin/sh\nprintf '%s\\n' " + JSON.stringify(response) + "\n", { mode: 0o755 });
    const result = spawnSync("/bin/sh", [launcher, f.image],
      { env: f.env, encoding: "utf8", timeout: 3000 });
    assert.equal(result.status, 78, result.stderr);
    assert(!fs.existsSync(path.join(f.dir, "launched")));
  });
}

test("PM2 refuses a missing authenticated display instead of using :0", t => {
  const f = fixture(t, true);
  delete f.env.DISPLAY;
  const result = spawnSync("/bin/sh", [launcher, f.image],
    { env: f.env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 78, result.stderr);
  assert(!fs.existsSync(path.join(f.dir, "launched")));
});

test("PM2 refuses a missing Xauthority instead of guessing a stale file", t => {
  const f = fixture(t, true);
  delete f.env.XAUTHORITY;
  const result = spawnSync("/bin/sh", [launcher, f.image],
    { env: f.env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 78, result.stderr);
  assert(!fs.existsSync(path.join(f.dir, "launched")));
});
