const video = document.getElementById("vid");
const osc = new OSC();
let ready = false;
let lastReport = -1;
let initialized = false;

function reportError(error) {
  window.transplayer.report({ error: error.message || String(error) });
}

video.addEventListener("error", () => {
  reportError(new Error(`Video error ${video.error && video.error.code}: ${video.error && video.error.message}`));
});

osc.on("error", () => reportError(new Error("Playback controller connection failed")));
osc.on("close", () => { ready = false; });
osc.on("open", async () => {
  ready = true;
  if (initialized) return;
  initialized = true;
  try {
    const config = await window.transplayer.config();
    video.addEventListener("loadedmetadata", async () => {
      try {
        if (!Number.isFinite(video.duration) || config.startSeconds >= video.duration) {
          throw new Error("Start time must be earlier than the video duration");
        }
        window.transplayer.report({
          event: "metadata", width: video.videoWidth, height: video.videoHeight,
          duration: video.duration, startSeconds: config.startSeconds,
        });
        video.currentTime = config.startSeconds;
        await video.play();
      } catch (error) { reportError(error); }
    }, { once: true });
    video.src = config.videoURL;
  } catch (error) { reportError(error); }
});
video.addEventListener("timeupdate", () => {
  if (ready) osc.send(new OSC.Message("/test/random", video.currentTime));
  const bucket = Math.floor(video.currentTime / 5);
  if (bucket !== lastReport) {
    lastReport = bucket;
    const quality = video.getVideoPlaybackQuality();
    window.transplayer.report({
      event: "playing", currentTime: video.currentTime,
      frames: quality.totalVideoFrames, dropped: quality.droppedVideoFrames,
    });
  }
});
osc.open({ host: "127.0.0.1", port: 8080 });
