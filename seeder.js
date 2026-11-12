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
  constructor({ urls, makeSession, probe, maxProfiles = 20, log = () => {} }) {
    this.urls = Array.from(urls);
    this.makeSession = makeSession;
    this.probe = probe;
    this.maxProfiles = maxProfiles;
    this.log = log;
  }

  async run() {
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
