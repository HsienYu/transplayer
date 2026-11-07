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
- [todo] Consider folding the dock gsetting (`dash-to-dock dock-fixed false`) into
  `configure` so a fresh install applies it automatically (currently a one-time manual step,
  documented in user-guide.md + operations.md).
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
