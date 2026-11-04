window.runProbe = async function (url) {
  const video = document.getElementById("video");
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function progress(stage) {
    console.log("GPU_PROBE_STAGE " + JSON.stringify({
      stage, currentTime: video.currentTime, readyState: video.readyState,
      networkState: video.networkState, paused: video.paused, seeking: video.seeking,
      errorCode: video.error ? video.error.code : 0,
    }));
  }
  let submitted = 0;
  video.requestVideoFrameCallback(function frame(now, metadata) {
    submitted = metadata.presentedFrames;
    video.requestVideoFrameCallback(frame);
  });
  progress("metadata-wait");
  const loaded = new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => {
      progress("media-error");
      reject(new Error("Video metadata failed"));
    };
  });
  video.src = url;
  await loaded;
  progress("metadata-ready");
  if (video.videoWidth !== 2160 || video.videoHeight !== 1920)
    throw new Error("Unexpected video geometry");
  const sought = new Promise(resolve => { video.onseeked = resolve; });
  progress("seek-wait");
  video.currentTime = 150;
  await sought;
  progress("seek-ready");
  function alpha() {
    const canvas = document.createElement("canvas");
    canvas.width = 96; canvas.height = 96;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(video, 0, 0, 96, 96);
    const data = context.getImageData(0, 0, 96, 96).data;
    let transparent = 0, opaque = 0, partial = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
      else if (data[i] === 255) opaque++;
      else partial++;
    }
    return { transparent, opaque, partial, pixels: 96 * 96 };
  }
  const initialAlpha = alpha();
  progress("alpha-ready");
  progress("play-wait");
  await video.play();
  progress("playing");
  progress("warmup-wait");
  await wait(5000);
  function snapshot() {
    const q = video.getVideoPlaybackQuality();
    return { wallMs: performance.now(), mediaSeconds: video.currentTime,
      frames: q.totalVideoFrames, dropped: q.droppedVideoFrames, submitted,
      readyState: video.readyState };
  }
  const begin = snapshot();
  progress("measurement-start");
  const samples = [];
  const timer = setInterval(() => samples.push(snapshot()), 5000);
  await wait(30000);
  clearInterval(timer);
  const end = snapshot();
  const finalAlpha = alpha();
  video.pause();
  progress("measurement-end");
  const frames = end.frames - begin.frames;
  const dropped = end.dropped - begin.dropped;
  return { begin, end, samples, initialAlpha, finalAlpha, frames, dropped,
    droppedPercent: frames > 0 ? dropped / frames * 100 : null,
    wallSeconds: (end.wallMs - begin.wallMs) / 1000,
    mediaSeconds: end.mediaSeconds - begin.mediaSeconds,
    submittedPerWallSecond: (end.submitted - begin.submitted) /
      ((end.wallMs - begin.wallMs) / 1000) };
};
