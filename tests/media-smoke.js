const { app, BrowserWindow } = require("electron");
const { pathToFileURL } = require("url");
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-media-"));
app.setPath("userData", path.join(directory, "profile"));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
let win;
app.whenReady().then(async () => {
  try {
    const page = path.join(directory, "probe.html");
    fs.writeFileSync(page, "<html><body style='background:transparent;margin:0'></body></html>");
    win = new BrowserWindow({
      show: false, transparent: true, width: 640, height: 480,
      webPreferences: { nodeIntegration: false, backgroundThrottling: false },
    });
    await win.loadFile(page);
    const src = pathToFileURL(process.env.TRANSPLAYER_VIDEO).href;
    const result = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.style.width = "640px";
      document.body.appendChild(video);
      const timer = setTimeout(() => reject(new Error("Media probe timed out")), 25000);
      video.onerror = () => reject(new Error("Media code " + video.error.code + ": " + video.error.message));
      video.onloadedmetadata = () => { video.currentTime = 775; };
      video.onseeked = async () => {
        video.onseeked = null;
        try {
          await video.play();
          setTimeout(() => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = 64; canvas.height = 64;
              const context = canvas.getContext("2d");
              context.drawImage(video, 0, 0, 64, 64);
              const data = context.getImageData(0, 0, 64, 64).data;
              let transparentPixels = 0;
              for (let i = 3; i < data.length; i += 4) if (data[i] < 255) transparentPixels++;
              const quality = video.getVideoPlaybackQuality();
              clearTimeout(timer);
              resolve({width:video.videoWidth,height:video.videoHeight,duration:video.duration,
                currentTime:video.currentTime,frames:quality.totalVideoFrames,
                dropped:quality.droppedVideoFrames,transparentPixels});
            } catch (error) { reject(error); }
          }, 8000);
        } catch (error) { reject(error); }
      };
      video.src = ${JSON.stringify(src)};
    })`);
    console.log("MEDIA_SMOKE", JSON.stringify(result));
    assert(result.currentTime > 775);
    assert(result.frames > 0);
    console.log("MEDIA_SMOKE PASS (muted hidden decode probe; not a visual acceptance test)");
    win.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error.stack);
    if (win) win.destroy();
    app.exit(1);
  }
});
