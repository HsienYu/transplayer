const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const script = path.resolve(__dirname, "../packaging/pm2-session.sh");

function fixture(t, state = "empty") {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-session-"));
  t.after(() => fs.rmSync(home, { recursive: true }));
  const node = path.join(home, ".local/share/transplayer/tools/node-v24.22.2-linux-x64/bin");
  const bin = path.join(home, ".local/share/transplayer/tools/pm2-7.1.1/node_modules/.bin");
  const supervisor = path.join(home, ".local/share/transplayer/supervisor/r9-20261030-login-safe");
  fs.mkdirSync(node, { recursive: true });
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(supervisor, "packaging"), { recursive: true });
  fs.symlinkSync(process.execPath, path.join(node, "node"));
  fs.writeFileSync(path.join(supervisor, "ecosystem.config.js"), "module.exports={apps:[]};\n");
  fs.writeFileSync(path.join(supervisor, "packaging/pm2-launch.sh"),
    '#!/bin/sh\nif [ "$FAKE_PM2_STATE" = online ]; then exit 78; fi\nprintf checked > "$HOME/checked"\n',
    { mode: 0o755 });
  const authority = path.join(home, "current-Xauthority");
  fs.writeFileSync(authority, "");
  const online = JSON.stringify([{ name: "transplayer", pm2_env: {
    status: "online", XAUTHORITY: authority, DISPLAY: ":55",
    pm_exec_path: path.join(supervisor, "packaging/pm2-launch.sh"),
  } }]);
  const stale = JSON.stringify([{ name: "transplayer", pm2_env: {
    status: "online", XAUTHORITY: path.join(home, "previous-Xauthority"),
    DISPLAY: ":55", pm_exec_path: path.join(supervisor, "packaging/pm2-launch.sh"),
  } }]);
  fs.writeFileSync(path.join(bin, "pm2"), `#!/bin/sh
printf '%s\\n' "$*" >> "$HOME/calls"
case "$1" in
  ping) exit 0 ;;
  jlist)
    case "$FAKE_PM2_STATE" in
      empty) printf '%s\\n' '[]' ;;
      online) printf '%s\\n' '${online}' ;;
      stale-online) printf '%s\\n' '${stale}' ;;
      stopped) printf '%s\\n' '[{"name":"transplayer","pm2_env":{"status":"stopped"}}]' ;;
      foreign) printf '%s\\n' '[{"name":"unrelated","pm2_env":{"status":"online"}}]' ;;
      errored) printf '%s\\n' '[{"name":"transplayer","pm2_env":{"status":"errored"}}]' ;;
    esac ;;
  delete|start|stop|ls) exit 0 ;;
  *) exit 1 ;;
esac
`, { mode: 0o755 });
  const env = {
    ...process.env, HOME: home, FAKE_PM2_STATE: state,
    DISPLAY: ":55", XAUTHORITY: authority,
    XDG_RUNTIME_DIR: home,
    DBUS_SESSION_BUS_ADDRESS: "unix:path=" + path.join(home, "bus"),
  };
  return { home, env };
}

function run(f, action = "login") {
  return spawnSync("/bin/sh", [script, action],
    { env: f.env, encoding: "utf8", timeout: 3000 });
}

test("fresh GNOME login starts only the pinned r9 process with this session's auth", t => {
  const f = fixture(t);
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  const calls = fs.readFileSync(path.join(f.home, "calls"), "utf8");
  assert.match(calls, /ping\njlist\nstart .*r9-20261030-login-safe\/ecosystem\.config\.js --only transplayer/);
  assert(!calls.includes("resurrect"));
  assert(!calls.includes("save"));
  assert(fs.existsSync(path.join(f.home, "checked")));
});
test("online player from a previous Xwayland login is refused, not silently accepted", t => {
  const f = fixture(t, "stale-online");
  const result = run(f);
  assert.equal(result.status, 78, result.stderr);
  assert.equal(fs.readFileSync(path.join(f.home, "calls"), "utf8"), "ping\njlist\n");
});

test("existing online player is never restarted on a second login invocation", t => {
  const f = fixture(t, "online");
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(f.home, "calls"), "utf8"), "ping\njlist\n");
  assert(!fs.existsSync(path.join(f.home, "checked")));
});

test("an old stopped definition is replaced, not resumed with stale auth", t => {
  const f = fixture(t, "stopped");
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(f.home, "calls"), "utf8"),
    /ping\njlist\ndelete transplayer\nstart .*r9-20261030-login-safe\/ecosystem\.config\.js --only transplayer/);
});

for (const state of ["foreign", "errored"]) {
  test("login refuses to alter a " + state + " PM2 state", t => {
    const f = fixture(t, state);
    const result = run(f);
    assert.equal(result.status, 78, result.stderr);
    assert.equal(fs.readFileSync(path.join(f.home, "calls"), "utf8"), "ping\njlist\n");
  });
}

test("login refuses absent Xwayland authentication without starting PM2", t => {
  const f = fixture(t);
  delete f.env.XAUTHORITY;
  const result = run(f);
  assert.equal(result.status, 78, result.stderr);
  assert(!fs.existsSync(path.join(f.home, "calls")));
});

test("stop addresses only the one named player", t => {
  const f = fixture(t);
  const result = run(f, "stop");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(f.home, "calls"), "utf8"), "stop transplayer\n");
});

test("unknown action refuses execution without invoking PM2", t => {
  const f = fixture(t);
  const result = run(f, "kill");
  assert.equal(result.status, 78, result.stderr);
  assert(!fs.existsSync(path.join(f.home, "calls")));
});
