const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { canvasBounds, loadConfig, timecode } = require("../portable");

test("two portrait displays form one 2160x1920 canvas", () => {
  assert.deepEqual(canvasBounds([
    { x: 0, y: 0, width: 1080, height: 1920 },
    { x: 1080, y: 0, width: 1080, height: 1920 },
  ]), { x: 0, y: 0, width: 2160, height: 1920 });
});

test("canvas handles negative origins and a single display", () => {
  assert.deepEqual(canvasBounds([
    { x: -1080, y: -20, width: 1080, height: 1920 },
    { x: 0, y: -20, width: 1080, height: 1920 },
  ]), { x: -1080, y: -20, width: 2160, height: 1920 });
  assert.deepEqual(canvasBounds([{ x: 1, y: 2, width: 10, height: 20 }]),
    { x: 1, y: 2, width: 10, height: 20 });
});

test("invalid and empty display bounds fail visibly", () => {
  for (const bounds of [[], [{ x: 0, y: 0, width: 0, height: 2 }],
    [{ x: NaN, y: 0, width: 1, height: 2 }]]) {
    assert.throws(() => canvasBounds(bounds), /display/i);
  }
});

test("configuration resolves media relative to the external config, not cwd", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const filename = path.join(dir, "config.json");
  fs.writeFileSync(path.join(dir, "影片.webm"), "synthetic fixture");
  fs.writeFileSync(filename, JSON.stringify({ videoPath: "影片.webm", startSeconds: 775 }));
  const config = loadConfig(filename);
  assert.equal(config.videoPath, path.join(dir, "影片.webm"));
  assert.equal(config.startSeconds, 775);
  assert.equal(config.expectedWidth, 2160);
  assert.equal(config.expectedHeight, 1920);
  assert.equal(config.videoTint, "rgba(230,230,230,0.12)"); // near-white wash on by default
});

test("videoTint defaults to a near-white wash, accepts safe colours, rejects unsafe ones", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const filename = path.join(dir, "config.json");
  fs.writeFileSync(path.join(dir, "v.webm"), "synthetic fixture");
  const write = (d) => fs.writeFileSync(filename, JSON.stringify(Object.assign({ videoPath: "v.webm" }, d)));
  write({});
  assert.equal(loadConfig(filename).videoTint, "rgba(230,230,230,0.12)");
  for (const c of ["rgba(230,230,230,0.12)", "rgb(200,200,200)", "#cccccc", "#ccc", "transparent", "rgba(0,0,0,0)"]) {
    write({ videoTint: c });
    assert.equal(loadConfig(filename).videoTint, c, `should accept ${c}`);
  }
  for (const c of ["red", "rgba(0,0,0,0); background:url(x)", "url(evil)", "expression(1)", "", 5, "#ggg"]) {
    write({ videoTint: c });
    assert.throws(() => loadConfig(filename), /videoTint/, `should reject ${JSON.stringify(c)}`);
  }
});

test("missing media, malformed configuration and hostile paths are rejected", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  const filename = path.join(dir, "config.json");
  fs.writeFileSync(path.join(dir, "valid.webm"), "synthetic fixture");
  for (const data of [
    { videoPath: "missing.webm" },
    { videoPath: "https://example.invalid/video.webm" },
    { videoPath: "bad\u0000.webm" },
    { videoPath: "valid.webm", startSeconds: -1 },
    { videoPath: "valid.webm", startSeconds: "775" },
    { videoPath: "valid.webm", expectedWidth: 0 },
    { videoPath: "valid.webm", unexpected: true },
    { videoPath: "." },
  ]) {
    fs.writeFileSync(filename, JSON.stringify(data));
    assert.throws(() => loadConfig(filename));
  }
  fs.writeFileSync(filename, "{broken");
  assert.throws(() => loadConfig(filename));
});

test("timecode accepts finite nonnegative numbers, not forged OSC values", () => {
  assert.equal(timecode([775.9]), 775);
  assert.equal(timecode([0]), 0);
  for (const value of [[], ["775"], [-1], [Infinity], [NaN], [1, 2], [{}]]) {
    assert.equal(timecode(value), null);
  }
});
