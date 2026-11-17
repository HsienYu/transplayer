"use strict";

// Orchestrates the snapshot seed: rotate a fresh Chrome profile that captures clean
// image-results pages back-to-back until Google gates one, then rotate to a new fresh
// profile (which retries the gated query first, in its own new-session grace window).
// Fresh anonymous profiles get that grace window even on a flagged IP, so this reaches
// the hard queries the long-lived display profiles never can. Bounded by maxProfiles so
// it never loops against Google; whatever is left is reported incomplete.
//
// Dependencies are injected so the orchestration is unit-tested without real Chrome:
//   makeSession(n) -> session with async start()/close()
//   probe(url, session) -> true if the page was clean and captured, false if gated
class SnapshotSeeder {
  constructor({ urls, makeSession, probe, maxProfiles = 20, retryGated = true, log = () => {} }) {
    this.urls = Array.from(urls);
    this.retryGated = retryGated;
    this.makeSession = makeSession;
    this.probe = probe;
    this.maxProfiles = maxProfiles;
    this.log = log;
  }

  async run() {
    if (!this.retryGated) {
      const captured = [], incomplete = [];
      let session;
      try {
        session = await this.makeSession(1);
        await session.start();
        for (const url of this.urls) {
          try {
            (await this.probe(url, session) ? captured : incomplete).push(url);
          } catch (error) {
            this.log(`seed query failed: ${error.message}`);
            incomplete.push(url);
          }
        }
      } catch (error) {
        this.log(`seed session failed: ${error.message}`);
        for (const url of this.urls) if (!captured.includes(url) && !incomplete.includes(url)) incomplete.push(url);
      } finally {
        if (session) await session.close();
      }
      return { captured, incomplete, profiles: 1 };
    }
    const remaining = Array.from(this.urls);
    const captured = [];
    let profiles = 0;
    while (remaining.length && profiles < this.maxProfiles) {
      profiles++;
      let session;
      try {
        session = await this.makeSession(profiles);
        await session.start();
        while (remaining.length) {
          const url = remaining[0];
          if (await this.probe(url, session)) {
            captured.push(url);
            remaining.shift();
            this.log(`seed cached ${captured.length}/${this.urls.length} url=${url}`);
          } else {
            // Burned profile: stop here and rotate. The gated url stays at the front
            // so the next fresh profile tries it first, in full grace.
            this.log(`seed rotate (gated) profile=${profiles} url=${url}`);
            break;
          }
        }
      } catch (error) {
        this.log(`seed profile ${profiles} error: ${error && error.message}`);
      } finally {
        if (session) { try { await session.close(); } catch (_) { /* best effort */ } }
      }
    }
    if (remaining.length) this.log(`seed incomplete ${captured.length}/${this.urls.length}`);
    else this.log(`seed complete ${captured.length}/${this.urls.length}`);
    return { captured, incomplete: remaining, profiles };
  }
}

module.exports = { SnapshotSeeder };

// Delay from completion prevents overlap even when collection takes longer than an hour.
class ScheduledRefresh {
  constructor({ run, intervalMs = 3600000, schedule = setTimeout, cancel = clearTimeout,
    log = console.error }) {
    Object.assign(this, { run, intervalMs, schedule, cancel, log });
    this.active = false;
    this.stopped = false;
  }
  async start() {
    if (this.active || this.stopped) return;
    this.active = true;
    try { await this.run(); }
    catch (error) { this.log(`snapshot refresh failed: ${error.message}`); }
    finally {
      this.active = false;
      if (!this.stopped) this.timer = this.schedule(() => this.start(), this.intervalMs);
    }
  }
  stop() { this.stopped = true; this.cancel(this.timer); }
}
function captureQuality(s, requirement) {
  const depth = requirement ? requirement.scroll + (s && s.viewportHeight || requirement.height) : 14000;
  return !!s && s.gated === false && Number.isFinite(s.loaded) && s.loaded >= 100 &&
    s.pending === 0 && Number.isFinite(s.height) && s.height >= depth &&
    Number.isFinite(s.bottom) && s.bottom >= depth;
}
module.exports.ScheduledRefresh = ScheduledRefresh;
module.exports.captureQuality = captureQuality;

// Owned by the timeline process; its stop handler awaits worker shutdown.
function startRefreshWorker() {
  const { fork } = require('child_process');
  let child;
  const scheduler = new ScheduledRefresh({ run: () => new Promise((resolve, reject) => {
    child = fork(require.resolve('./seed'), [], { env: { ...process.env,
      ELECTRON_RUN_AS_NODE: '1', TRANSPLAYER_SNAPSHOT_ONLY: '1' }, silent: false });
    child.once('error', reject);
    child.once('exit', code => { child = null;
      if (code === 0) resolve(); else reject(Error(`seed exited ${code}`)); });
  }) });
  scheduler.start();
  return async () => {
    scheduler.stop();
    if (child) {
      const current = child;
      await new Promise(resolve => { current.once('exit', resolve); current.kill('SIGTERM'); });
    }
  };
}
module.exports.startRefreshWorker = startRefreshWorker;

// Only visible, substantial thumbnails count; hidden placeholders/icons cannot satisfy depth.
const QUALITY_JS = `return (() => {
  const images = Array.from(document.images).filter(img => {
    const r = img.getBoundingClientRect();
    return r.width >= 60 && r.height >= 60 && getComputedStyle(img).visibility !== 'hidden';
  });
  const loaded = images.filter(img => img.complete && img.naturalWidth >= 60 && img.naturalHeight >= 60);
  return { loaded: loaded.length, pending: images.length - loaded.length,
    viewportHeight: innerHeight, viewportWidth: innerWidth,
    height: document.documentElement.scrollHeight,
    bottom: loaded.reduce((n, img) => Math.max(n, img.getBoundingClientRect().bottom + scrollY), 0) };
})()`;

module.exports.QUALITY_JS = QUALITY_JS;

function snapshotArtifactQuality(data) {
  if (typeof data !== 'string' || Buffer.byteLength(data) > 64 * 1024 * 1024)
    return { clean: false, reason: 'invalid' };
  try {
    const result = require('child_process').spawnSync('python3',
      [require('path').join(__dirname, 'snapshot_quality.py')],
      { input: data, encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
    if (result.status !== 0 || result.error) return { clean: false, reason: 'validator-unavailable' };
    const verdict = JSON.parse(result.stdout);
    return verdict && typeof verdict.clean === 'boolean' ? verdict : { clean: false, reason: 'invalid' };
  } catch (_) { return { clean: false, reason: 'validator-unavailable' }; }
}
module.exports.snapshotArtifactQuality = snapshotArtifactQuality;

async function waitForClean({check, timeoutMs = 90000, pollMs = 1000,
  now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  const deadline = now() + timeoutMs;
  while (true) {
    try { if (await check()) return true; } catch (_) { return false; }
    const remaining = deadline - now();
    if (remaining <= 0) return false;
    await sleep(Math.min(pollMs, remaining));
  }
}
module.exports.waitForClean = waitForClean;
