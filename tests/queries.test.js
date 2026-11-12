const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const queries = require("../queries");

test("queries.js is exactly the image-search URL set in web-process-new.js", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "web-process-new.js"), "utf8");
  const found = new Set(src.match(/https:\/\/www\.google\.com\/search\?q=[^"']*/g) || []);
  const listed = new Set(queries);
  assert.equal(queries.length, listed.size, "queries.js contains duplicates");
  assert.equal(listed.size, 13, "expected 13 canonical queries");
  for (const u of found) assert(listed.has(u), `timeline URL missing from queries.js: ${u}`);
  for (const u of listed) assert(found.has(u), `queries.js URL not in the timeline: ${u}`);
});
