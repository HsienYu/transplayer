# Plan: transplayer r10 Ubuntu 26.04 exhibition deployment

Workflow: Hybrid (Section 7, hardware/real-time video) + Deployment (Section 14) +
Production change (Section 24).

Exhibition host: `hcw@100.72.17.111` (Tailscale), hostname `hcw-MS-7D17` — Ubuntu 26.04.1
LTS, GNOME Shell 50.1 / Wayland, MSI MS-7D17 board, 12 threads / 14 GiB RAM, NVIDIA
RTX 4060 / driver 595.99.02.

## Current status (2026-11-07)

`1.1.0~rc8` is deployed and live-verified on the host (reboot autoplay, 0 dropped frames).
`master` holds the rc8 line plus post-deploy doc/cleanup commits and is pushed
(`origin/master` = `d470845`). Tag `v1.1.0-rc8` sits at the deployed commit `d916b66`, and
GitHub Release v1.1.0-rc8 is public with the `.deb` (SHA-256 `5a919d05…`). The repo is
consolidated to `master` (the deploy / fix-r10 / fix-r7b / dependabot branches were removed).
This is still an **RC** — the stable-release gates below are not all passed.

完整 rc3–rc8 歷程與 2026-11-07 02:05 前的 Handoff Log 見
[docs/plan-archive/2026-11.md](docs/plan-archive/2026-11.md)。

## Open items / 待辦

- [todo] Stable-release gates (before promoting beyond RC or tagging a stable release):
  full playback/audio/UI/performance acceptance, lifecycle/boot/rollback verification,
  long-duration soak, lintian, dependency-vulnerability remediation (GitHub reports 19 on
  the Selenium/OSC chain: 12 high / 5 moderate / 2 low), license/distribution approval.
- [todo] Long-duration soak on the live host: snapshot-cache behaviour and resource/error/
  restart counts over hours/days. Only point-in-time confirmations exist so far.
- [todo] `transplayer snapshot-seed` CLI: package the manual seed (fresh profile, two passes
  cover all 13 queries) so the museum can re-seed on demand. Autostart persistence is blocked
  by the harness, so it stays a manual op.
- [todo] Consider folding the two dock gsettings (`dash-to-dock dock-fixed false` +
  `intellihide false`) into `configure` so a fresh install applies them automatically
  (currently a one-time manual step, documented in user-guide.md + operations.md). The dock
  extension must stay enabled — the desktop guard operates `dock._intellihide`.
- [todo] Keyring: auto-login leaves the login keyring locked and a persistent auto-unlock was
  blocked by the harness; the operator does the one-time empty-password step on remote-connect
  if the prompt recurs. Not visitor-facing.
- [todo] Window 13 (full-screen background) recreation after a mid-loop crash would briefly
  revert to default size until the next task 65/775. Not seen in clean automated runs; a
  controller-creation safeguard would fix it but risks raising a recreated 13 above active
  subwindows. Deferred.

## Notes / safety

- The `hcw` sudo password was shared in chat. It was NOT used — studio already had SSH key
  access to the host. Recommend changing it since it now exists in a transcript. The password
  is not written to any file, commit, doc, or memory.

## Handoff Log

### 2026-11-07 20:38 CET -- Claude Code (Opus 4.8)
- State: rc8 built, deployed and live-verified on hcw-MS-7D17. Two artist-requested fixes:
  (1) Window 13 is now a persistent FULL-SCREEN BACKGROUND that fills the whole 2160x1920 desktop
  edge-to-edge. Root cause of the earlier purple margin: a normal Chrome window's outer size
  INCLUDES the GTK CSD invisible shadow (_GTK_FRAME_EXTENTS measured 22,22,19,25), so {0,0,2160,1920}
  left the visible content inset. Fix: `bg_rect = {-22,-19,2204,1964}` oversizes+offsets by the shadow
  (web-process-new.js, used at task 65 AND task 775; the WM honors the negative offset via setRect).
  (2) Disabled the NopeCHA extension by default (runtime.py env.update adds
  TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION=1), dropping the on-screen NopeCHA bar AND Chrome's
  "developer mode extensions" warning bar (NopeCHA can't solve the Enterprise reCAPTCHA; snapshot
  cache handles gating). Also: desktop dock no longer reserves space
  (`gsettings set org.gnome.shell.extensions.dash-to-dock dock-fixed false`, dconf-persistent) so
  _NET_WORKAREA is the full 0,0,2160,1920 and windows reach the left edge.
  rc8 deb SHA256 = 5a919d05a08bc6b31770f5d02067a2ed2a6e320eef0680a9b79632c18884a0a5 (built on hcw at
  ~/.cache/transplayer-builds/r10-rc8-20261107T192715Z/). Live verify: version 1.1.0~rc8, window 13
  wmctrl -44,-38 2204x1964 (visible fills 2160x1920), no --load-extension on any chrome, log
  "captcha-extension disabled", snapshots 13/13, 150/150 node tests pass.
- Decisions: Built rc8 by reusing the known-good rc7 stage/ tree (swap web-process-new.js +
  runtime.py + release.json, refresh the one web-process-new.js SHA256SUMS line + DEBIAN/control
  version), not the full studio->host pipeline -- lowest-risk minimal diff from rc7; nothing verifies
  SHA256SUMS at install/runtime (proven by the live in-place patches running fine). Chose setRect
  shadow-compensation over app-mode/fullscreen (both clamp a window to a single 1080 monitor, which
  breaks every cross-seam window) and over maximize (raises above sub-windows). The dock setting is
  NOT in the .deb -- a fresh museum install must run it once (documented in user-guide.md +
  operations.md).
- Next steps: finishing the artist's requested wrap-up -- GitHub release v1.1.0-rc8 (deb asset
  rsync'ing to studio in background over the slow ~43KB/s tailscale link, ~2h; attach when it lands),
  merge HsienYu/transplayer-deploy -> master, remove this worktree. The earlier reCAPTCHA/snapshot
  work (rc7) is unchanged and still live. Consider: fold the dock gsetting into `configure` so new
  installs get it automatically; package the manual snapshot-seed CLI.
- Open questions: window 13 recreation mid-loop (crash) would momentarily revert it to default size
  until the next task 65/775 -- not observed in clean automated runs, deferred (a controller-creation
  safeguard would fix it but risks raising a recreated 13 above active subs). PLAN.md is ~40KB, over
  the 30KB archive threshold -- archive finished pre-rc8 sections next resume.

### 2026-11-07 23:01 CET (22:01Z) — Claude Code (Opus 4.8)
- State: rc8 wrap-up completed with the user directly. Merged HsienYu/transplayer-deploy ->
  master (fast-forward to the deployed d916b66, then two commits: rc8 doc currency + repo
  cleanup) and pushed; origin/master = d470845. Tag v1.1.0-rc8 confirmed already on origin at
  d916b66; GitHub Release v1.1.0-rc8 public with the .deb (SHA 5a919d05…). Install docs now
  show rc8 + the verified SHA + the Release download link. Full-tree cleanup removed superseded
  docs, the completed experiments and their dead tests, the retired r9 docs, the unused
  alpha-recomposite module + plan, and stale smoke scripts (132 Node / 52 Python green, no
  dangling refs). Repo consolidated to master (deploy / fix-r10 / fix-r7b / 7× dependabot
  branches deleted, user-approved). All four docs/ files rewritten to current state
  (resolved-issue narration dropped). This commit archives PLAN.md per Section 2.
- Decisions: deleted branches/files are recoverable from git history (fix/r7b's unmerged tip
  was 3d678f8). Did NOT push a stable tag beyond the existing rc8 — stable promotion waits on
  the user after the gates. Kept the legacy desktop-guard path (runtime-selected by main.js)
  and the historical gnome49 dir name; removing them is a code change, out of scope.
- Next steps: the stable-release gates above (soak, lintian, license, vuln remediation);
  the snapshot-seed CLI; optional dock-gsetting-into-configure. Deleting the dependabot
  branches only closed the PRs — the 19 vulnerabilities still need real dependency upgrades
  (or disable Dependabot to stop PR re-creation).
- Open questions: when to promote beyond RC to a stable release/tag (user's call).

### 2026-11-12 05:11 CET (04:11Z) — Claude Code (Opus 4.8)
- State: reCAPTCHA stale/grey mitigation chain rc9→rc14, all deployed to the live host and
  merged+tagged locally (push + GitHub Release done through rc13; rc14 push/Release still
  pending user go-ahead). rc14 (`master` 97addf8, tag `v1.1.0-rc14`) DEPLOYED 04:10Z: slow
  snapshot seed — `controller.waitImagesSettled()` waits for Google image thumbnails to
  actually load (`complete && naturalWidth>0`, not just has-src) before capture; `.n` sidecar
  records the loaded count; `writeSnapshotIfRicher()` never downgrades a richer SAME-DAY
  snapshot (an older one is always refreshed, so freshness still wins). 158 Node / 52 Python
  green (9 new). Host rebooted; boot auto-seed (the new slow seed) running; live verification
  of self-containment IN PROGRESS (background monitor bjm6coth2).
- Decisions: (1) Grey root cause measured, not assumed — the display RE-FETCHES unembedded
  thumbnails from the network (live "map of melaka fort": 217/220 loaded, 3 grey), so
  under-embedding causes brief grey on re-fetch, not permanent grey; rc14 makes snapshots
  self-contained. User chose "keep seed, wait for images to load" over reverting to
  opportunistic capture (which would bring back the ~7 stale hard queries). (2) rc13 account
  login (A) is DONE and logged in (seed-account has Cookies ~32 KB; login-seed captured
  13/13); efficacy (does the account reduce gating?) NOT yet cleanly confirmed — needs a
  second seed showing profiles≤2. (3) Deploy gotcha recorded: the maintenance gate
  (`maintenance.py scan_processes`) refuses install while ANY process exe is under
  /opt/transplayer/releases or /usr/lib/transplayer — INCLUDING the PM2 God daemon that
  `transplayer stop`/pm2 spawn. Correct order: `prepare-maintenance` (it runs `pm2 kill`,
  runtime.py:219) → wait until 0 such processes → install; do NOT run `transplayer stop`
  after prepare-maintenance (it respawns the daemon). A first attempt failed on this and left
  rc13 half-configured; recovered with `dpkg --configure transplayer`.
- Next steps: (a) finish rc14 live verification — re-run the embedded-vs-<img> analysis; pass
  = suspects ≥90% embedded (were ~48%), rest ≥90% (were ~70%), `.n` ≈ embedded; confirm boot
  autoplay + two portrait displays. (b) On the user's go-ahead, push master + tag v1.1.0-rc14
  and cut the GitHub pre-release with the rc14 .deb (host build
  r10-rc14-20261112T040452Z/…rc14_amd64.deb, SHA 488cdedf). (c) Recommend rotating the hcw
  sudo password (it is in this transcript).
- Open questions: **Q3 STILL OPEN** — the user reported (rc13) a window loading clean then
  gating MID-scroll and staying stuck on reCAPTCHA (not jumping to the snapshot). It did NOT
  reproduce in ~4 min of CDP polling (serveSnapshotIfGated fired 0 times; windows mostly gate
  at goTo and serve the snapshot there). Untested hypothesis: the gate lands AFTER scrollTo's
  ~90s loop ends, leaving the window idle on a live gated page with no recheck until the next
  goTo — a lightweight post-scroll recheck timer would fix that, not a detection change.
  Resolve with live ground truth next time the user reports a stuck window (CDP /json on the
  se_* debug ports — se_13 writes --remote-debugging-port in /proc/<pid>/cmdline — or the
  profile History DB).
