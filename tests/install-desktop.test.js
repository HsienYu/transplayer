const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-install-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const desktop = path.join(root, "Desktop"), bin = path.join(root, "bin");
  fs.mkdirSync(desktop); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "xdg-user-dir"), `#!/bin/sh\nprintf '%s\\n' '${desktop}'\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "gio"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const image = path.join(root, "AppDir with spaces", "AppRun");
  fs.mkdirSync(path.dirname(image));
  fs.writeFileSync(image, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const video = path.join(root, "作品.webm");
  fs.writeFileSync(video, "synthetic media");
  return { root, desktop, image, video, run: (...args) => spawnSync("python3", [
    path.resolve(__dirname, "../packaging/install-desktop.py"), ...args, "--video", video,
  ], { encoding: "utf8", env: { ...process.env, HOME: root, PATH: `${bin}:${process.env.PATH}` } }) };
}

test("AppDir entrypoint installs quoted launchers and private media config", t => {
  const f = fixture(t), result = f.run("--executable", f.image);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const launcher = fs.readFileSync(path.join(f.desktop, "Transplayer.desktop"), "utf8");
  assert(launcher.includes(`Exec="${fs.realpathSync(f.image)}"`));
  const config = path.join(f.root, ".config/transplayer/config.json");
  assert.equal(JSON.parse(fs.readFileSync(config)).videoPath, fs.realpathSync(f.video));
  assert.equal(fs.statSync(config).mode & 0o777, 0o600);
  const again = f.run("--executable", f.image);
  assert.notEqual(again.status, 0);
  assert.match(again.stdout + again.stderr, /refusing to overwrite/i);
});

test("AppImage compatibility and mutually exclusive entrypoint selection", t => {
  const f = fixture(t);
  const ambiguous = f.run("--appimage", f.image, "--executable", f.image);
  assert.notEqual(ambiguous.status, 0);
  assert(!fs.existsSync(path.join(f.desktop, "Transplayer.desktop")));
  const old = f.run("--appimage", f.image);
  assert.equal(old.status, 0, old.stdout + old.stderr);
});

test("non-executable AppDir is rejected before creating config or shortcuts", t => {
  const f = fixture(t); fs.chmodSync(f.image, 0o644);
  const result = f.run("--executable", f.image);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /must be executable/i);
  assert(!fs.existsSync(path.join(f.root, ".config/transplayer/config.json")));
});
