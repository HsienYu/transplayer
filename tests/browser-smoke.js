// Run with the packaged Electron's Node runtime on the actual Linux desktop.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "transplayer-smoke-"));
process.env.TRANSPLAYER_PROFILE_DIR = profile;
const root = process.env.TRANSPLAYER_APP_ROOT;
if (!root) throw new Error("TRANSPLAYER_APP_ROOT is required");
const Controller = require(path.join(root, "controller"));
const controller = new Controller();
controller.SCROLL_GAP = 20;
controller.SCROLL_INTERVAL = 1;

(async () => {
  try {
    assert.equal(await controller.goTo(0,
      "data:text/html,<html><body style='height:6000px'><h1>Transplayer synthetic scroll test</h1></body></html>"), true);
    assert.equal(await controller.setBrowserRect(0, { x: 20, y: 20, width: 640, height: 600 }), true);
    const driver = await controller.getWebDriver(0);
    const rect = await driver.manage().window().getRect();
    assert.equal(rect.width, 640);
    assert.equal(rect.height, 600);
    await controller.scrollTo(0, 400);
    const offset = await driver.executeScript("return window.pageYOffset");
    assert(offset > 0, "The real browser must scroll");
    console.log("BROWSER_SMOKE", JSON.stringify({ rect, scrollOffset: offset }));
  } finally {
    const results = await controller.closeAllBrowser();
    assert(results.every(Boolean), "All owned sessions must quit");
    fs.rmdirSync(profile, { recursive: true });
  }
  console.log("BROWSER_SMOKE PASS");
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
