"use strict";
// One-shot snapshot seed (B): capture a clean image-results page for every query into
// the shared snapshot cache, rotating fresh Chrome profiles so the hard queries the
// long-lived display profiles can never reach are captured in a new-session grace window.
// Reuses the live player's clean-check and atomic writer (controller.js). Invoked by
// `transplayer snapshot-seed`.
process.env.TRANSPLAYER_SEED = "1";                     // Controller must not wipe the player's se_*
process.env.TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION = "1"; // never load NopeCHA (can't solve Enterprise)

const path = require("path");
const os = require("os");
const fs = require("fs");
const { ChromeSession } = require("./chrome-session");
const Controller = require("./controller");
const queries = require("./queries");
const { SnapshotSeeder } = require("./seeder");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROFILE_ROOT = process.env.TRANSPLAYER_PROFILE_DIR ||
  path.join(os.homedir(), ".local/share/transplayer/profiles-r10-basic");
const CHROME = process.env.TRANSPLAYER_CHROME;
const DRIVER = process.env.TRANSPLAYER_DRIVER;

async function scrollToLoad(driver) {
  // Google image search lazy-loads thumbnails as you scroll. Scroll down in small steps,
  // waiting for each batch to load, far past the display's scroll range, then return to the
  // top so the captured MHTML renders images from the start — otherwise the snapshot has
  // large blank areas where thumbnails had not loaded yet.
  for (let i = 0; i < 20; i++) {
    try { await driver.executeScript("window.scrollBy(0, 1200)"); } catch (_) { /* ignore */ }
    await sleep(600);
  }
  try { await driver.executeScript("window.scrollTo(0, 0)"); } catch (_) { /* ignore */ }
  await sleep(800);
}

async function main() {
  if (!CHROME || !DRIVER) {
    console.error("seed: TRANSPLAYER_CHROME / TRANSPLAYER_DRIVER not set");
    return 2;
  }
  const controller = new Controller(); // only for isCleanResults / writeSnapshot / snapshotPath
  const seedProfiles = [];

  const makeSession = async (n) => {
    const profileDir = path.join(PROFILE_ROOT, `seed-${n}`);
    seedProfiles.push(profileDir);
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) { /* fresh */ }
    // Launch offscreen (beyond the 2160-wide desktop) so a boot-time seed never flashes
    // over the artwork; the probe also setRects as a fallback.
    return new ChromeSession({ chromePath: CHROME, driverPath: DRIVER, profileDir, env: process.env,
      extraArgs: ["--window-position=4000,0", "--window-size=1280,900"] });
  };

  const probe = async (url, session) => {
    const driver = session.driver;
    try { await driver.get(url); } catch (_) { return false; }
    // Push the seed window offscreen (best effort) so a boot-time run is not visible.
    try { await driver.manage().window().setRect({ x: 4000, y: 0, width: 1280, height: 900 }); }
    catch (_) { /* WM may clamp; not fatal */ }
    await scrollToLoad(driver);
    if (!(await controller.isCleanResults(driver))) return false;
    try {
      const mhtml = await session.captureSnapshot();
      if (controller.writeSnapshot(url, mhtml)) {
        console.log(`CAPTCHA cached-snapshot url=${url} bytes=${mhtml.length}`);
        return true;
      }
      return false;
    } catch (_) { return false; }
  };

  const seeder = new SnapshotSeeder({
    urls: queries, makeSession, probe, maxProfiles: 20,
    log: (m) => console.log(m),
  });
  const result = await seeder.run();
  for (const p of seedProfiles) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
  console.log(`seed result captured=${result.captured.length}/${queries.length} ` +
    `profiles=${result.profiles} incomplete=${result.incomplete.length}`);
  return result.incomplete.length === 0 ? 0 : 1;
}

if (require.main === module) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error("seed fatal", e && e.message);
    process.exit(3);
  });
}

module.exports = { main };
