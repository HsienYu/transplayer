const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

test("r10 installer Python acceptance and hostile-input tests", () => {
  const result = spawnSync("python3", [
    path.join(__dirname, "installer_cases.py"),
  ], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
