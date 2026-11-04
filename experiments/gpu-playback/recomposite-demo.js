// Standalone demo: play the packed opaque sample through the WebGL recompositor and show
// the reconstructed transparency over a background. Independent of VA-API / hardware decode
// -- this verifies ONLY that the colour+alpha repack and shader faithfully rebuild the
// transparent image. Open this file in a browser on a machine that can see packed-sample.mp4.
"use strict";
(function () {
  const video = document.getElementById("vid");
  const canvas = document.getElementById("cv");
  const hint = document.getElementById("hint");
  function fail(message) { hint.textContent = "DEMO ERROR: " + message; }

  function begin() {
    try {
      const recompositor = window.AlphaRecomposite.createRecompositor({
        video, canvas, layout: "vstack-alpha",
      });
      recompositor.start();
      video.play().catch((e) => fail("video.play: " + e.message));
    } catch (error) {
      fail(error.message || String(error));
    }
  }

  if (video.readyState >= 1) begin();
  else video.addEventListener("loadedmetadata", begin, { once: true });
  video.addEventListener("error", () =>
    fail("cannot load packed-sample.mp4 (is it beside this page?)"));
})();
