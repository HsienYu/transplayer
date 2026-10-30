const fs = require("fs");
const path = require("path");

function canvasBounds(displays) {
  if (!Array.isArray(displays) || !displays.length || displays.some(d =>
    !d || !["x", "y", "width", "height"].every(k => Number.isFinite(d[k])) ||
    d.width <= 0 || d.height <= 0)) {
    throw new Error("Invalid display bounds");
  }
  const x = Math.min(...displays.map(d => d.x));
  const y = Math.min(...displays.map(d => d.y));
  return {
    x, y,
    width: Math.max(...displays.map(d => d.x + d.width)) - x,
    height: Math.max(...displays.map(d => d.y + d.height)) - y,
  };
}

function loadConfig(filename) {
  if (!filename) throw new Error("TRANSPLAYER_CONFIG must name an external JSON file");
  const input = JSON.parse(fs.readFileSync(filename, "utf8"));
  const allowed = ["videoPath", "startSeconds", "expectedWidth", "expectedHeight"];
  if (!input || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) {
    throw new Error("Invalid configuration fields");
  }
  const config = Object.assign({ startSeconds: 775, expectedWidth: 2160, expectedHeight: 1920 }, input);
  if (typeof config.videoPath !== "string" || !config.videoPath ||
      config.videoPath.includes("\0") || /^[a-z]+:\/\//i.test(config.videoPath)) {
    throw new Error("videoPath must be a local file");
  }
  if (!Number.isFinite(config.startSeconds) || config.startSeconds < 0 ||
      !Number.isInteger(config.expectedWidth) || config.expectedWidth <= 0 ||
      !Number.isInteger(config.expectedHeight) || config.expectedHeight <= 0) {
    throw new Error("Invalid start time or expected display dimensions");
  }
  config.videoPath = path.resolve(path.dirname(path.resolve(filename)), config.videoPath);
  fs.accessSync(config.videoPath, fs.constants.R_OK);
  if (!fs.statSync(config.videoPath).isFile()) throw new Error("Video must be a file");
  return config;
}

function timecode(args) {
  if (!Array.isArray(args) || args.length !== 1 ||
      typeof args[0] !== "number" || !Number.isFinite(args[0]) || args[0] < 0) {
    return null;
  }
  return Math.floor(args[0]);
}

module.exports = { canvasBounds, loadConfig, timecode };
