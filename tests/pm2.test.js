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
  write("gdbus", 'printf "%s\\n" "(true, \'true\')"\n');
  write("sleep", 'printf waited > "$FIXTURE/waited"\nprintf ready > "$FIXTURE/ready"\n');
  const image = path.join(dir, "Fake AppImage");
  fs.writeFileSync(image, '#!/bin/sh\nprintf launched > "$FIXTURE/launched"\n', { mode: 0o755 });
  if (ready) fs.writeFileSync(path.join(dir, "ready"), "");
  return { dir, bin, image, env: { ...process.env, PATH: bin, FIXTURE: dir } };
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
  assert.deepEqual(app.stop_exit_codes, [0, 78]);
  assert.equal(app.watch, false);
  assert.equal(app.env.TRANSPLAYER_NONINTERACTIVE, "1");
  assert(app.env.XAUTHORITY);
  assert(app.env.DBUS_SESSION_BUS_ADDRESS.startsWith("unix:path="));
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
    '#!/bin/sh\nif test -f "$FIXTURE/waited"; then printf "%s\\n" "(true, \'true\')"; else printf "%s\\n" "(false, \'\')"; fi\n',
    { mode: 0o755 });
  const result = spawnSync("/bin/sh", [launcher, f.image], { env: f.env, encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 0, result.stderr);
  assert(fs.existsSync(path.join(f.dir, "waited")));
  assert(fs.existsSync(path.join(f.dir, "launched")));
});
