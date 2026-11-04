"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  packedLayout, recompositePixels, createRecompositor, LAYOUTS,
} = require("../app/alpha-recomposite.js");

test("vstack layout splits a W x 2H packed frame into equal colour/alpha halves", () => {
  const r = packedLayout(2160, 3840);
  assert.equal(r.layout, "vstack-alpha");
  assert.equal(r.contentWidth, 2160);
  assert.equal(r.contentHeight, 1920);
  assert.deepEqual(r.color, { x: 0, y: 0, width: 2160, height: 1920 });
  assert.deepEqual(r.alpha, { x: 0, y: 1920, width: 2160, height: 1920 });
});

test("packed height must be even (a clean vertical stack), odd is rejected", () => {
  assert.throws(() => packedLayout(2160, 3841), /even/);
});

test("non-positive or non-integer packed dimensions are rejected", () => {
  assert.throws(() => packedLayout(0, 100), /positive integers/);
  assert.throws(() => packedLayout(100, -2), /positive integers/);
  assert.throws(() => packedLayout(100.5, 200), /positive integers/);
});

test("unknown layouts are rejected rather than silently mishandled", () => {
  assert.throws(() => packedLayout(10, 20, "sidebyside"), /Unsupported packed layout/);
  assert.ok(LAYOUTS.includes("vstack-alpha"));
});

test("recompositePixels rebuilds RGBA: colour from the top half, alpha from bottom-half luma", () => {
  const W = 2, H = 4; // content 2x2
  const packed = new Uint8ClampedArray([
    // row 0 (colour)
    10, 20, 30, 255, 40, 50, 60, 255,
    // row 1 (colour)
    70, 80, 90, 255, 100, 110, 120, 255,
    // row 2 (alpha as luma in red)
    200, 0, 0, 255, 150, 0, 0, 255,
    // row 3 (alpha)
    5, 0, 0, 255, 255, 0, 0, 255,
  ]);
  const out = recompositePixels(packed, W, H);
  assert.deepEqual(Array.from(out), [
    10, 20, 30, 200, 40, 50, 60, 150,
    70, 80, 90, 5, 100, 110, 120, 255,
  ]);
});

test("recompositePixels rejects a buffer whose size does not match width*height*4", () => {
  assert.throws(() => recompositePixels(new Uint8ClampedArray(10), 2, 4), /buffer size/);
});

test("createRecompositor requires both a video and a canvas", () => {
  assert.throws(() => createRecompositor({ canvas: {} }), /video and canvas are required/);
  assert.throws(() => createRecompositor({ video: {} }), /video and canvas are required/);
});

test("createRecompositor fails visibly when WebGL is unavailable", () => {
  const fakeCanvas = { getContext: () => null };
  assert.throws(
    () => createRecompositor({ video: {}, canvas: fakeCanvas }),
    /WebGL is not available/,
  );
});
