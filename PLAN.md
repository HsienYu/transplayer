# Plan: transplayer r10 Ubuntu 26 exhibition deployment (formal host hcw)

Workflow: Hybrid (Section 7, hardware/real-time video) + Deployment (Section 14) +
Production change (Section 24). The performance fix is gated on the artist's visual
acceptance because every real option alters the artwork's video pipeline.

Formal host: `hcw@100.84.243.117` (Tailscale) — Ubuntu 26.04.1 LTS, GNOME 50.1,
Celeron G3930 (2 cores), 15 GiB RAM, RTX 4060 / NVIDIA 595.99.02. Two ASUS VP247
1920x1080 panels (DP-2 serial G9L..., HDMI-1 serial H3L...).

Branch: `fix/r10-linux-optional-dependencies` (pushed to origin). Master stays clean
at `ab8bf5d`; no stable tag/promotion (release gates below are not all passed).

## Status

- [done] Diagnose the dropped-frames root cause with primary evidence (VP9 + `alpha_mode=1`;
  Chromium 156 refuses HW decode for alpha unless HEVC; libvpx software decode on a 2-core
  Celeron). See [docs/performance.md](docs/performance.md).
- [done] Commit the accumulated r10 work on the branch (installer optional-dep fix; rc2 GPU
  compositing + Chrome profile hardening; GPU A/B spike; docs/runbook). Suites run green on
  2026-11-04: Node 126/0/0, Python installer 52 OK, Python gpu_probe 15 OK.
- [done] Push the branch to origin (`fix/r10-linux-optional-dependencies` = ecf8b1c).
- [done] Enable login autostart on the formal host via `transplayer configure --autostart`
  (owned entry `~/.config/autostart/transplayer-r10.desktop`, Exec `transplayer login`).
- [todo] Make autostart actually render on boot. BLOCKED: the two displays are currently
  LANDSCAPE (1920x1080); the prior temporary portrait rotation was lost on a session reset.
  `transplayer login` runs `check_displays`, which requires two 1080x1920 PORTRAIT panels,
  so it will refuse to play until rotation is set AND persisted (monitors.xml). A one-shot
  persist script is staged on the host (see Handoff Log). Applying it rotates the live
  screens and the physical up/left-right cannot be verified remotely, so it is left for the
  operator/user to run with the `transplayer screens` visual check, then reboot to verify.
- [~] Performance fix for dropped frames. User authorized altering the artwork/transcoding
  (2026-11-04); alpha MUST be preserved (browser shows behind the video). Chosen route:
  opaque-repack (colour-over-alpha vstack) + WebGL recomposite + VA-API/NVDEC. Built this
  round on the branch: `app/alpha-recomposite.js` + tests (134 green), a standalone demo with
  a real packed sample staged on the host, and staged operator scripts (`enable-hw-decode.sh`,
  `make-alpha-pack.sh`). NOT activated. Blocked tonight because no HW-decode path is testable
  until `nvidia-vaapi-driver` is installed (one operator sudo step) and the artist visually
  accepts the recomposited playback. Full design + remaining wiring:
  [docs/alpha-hw-decode-plan.md](docs/alpha-hw-decode-plan.md). rc2 (GPU compositing) stays
  the deployed state; the live player was not touched.
- [todo] Physical display orientation acceptance (upright, left/right vs physical mount) —
  needs on-site eyes via `transplayer screens`.
- [todo] Reboot + autoplay acceptance (after rotation persisted) — not done tonight to avoid
  interrupting the live test session while the user rests; left as the user's gated step.
- [todo] Remaining release gates before any stable promotion / Git master merge / tag: full
  playback/audio/UI/performance acceptance, lifecycle/boot/rollback verification, soak test,
  lintian, dependency-vulnerability remediation (GitHub dependabot shows alerts on master),
  license/distribution approval.

## Notes / safety

- The `hcw` sudo password was shared in chat. It was NOT used — studio already had SSH key
  access to the host. Recommend changing it since it now exists in a transcript. The password
  is not written to any file, commit, doc, or memory.
- No stable release, tag, or master merge was made; `同步到git` was satisfied by pushing the
  feature branch. Whether to merge to master is the user's call (see morning report).

## Handoff Log

### 2026-11-04 06:14 CET (05:14Z) -- Claude Opus 4.8 (studio, operating hcw over Tailscale key)
- State: Branch committed + pushed (ecf8b1c). Autostart enabled on hcw. Diagnosis and
  performance memo written. Displays currently landscape; rotation persistence and reboot
  deliberately NOT applied overnight (would rotate the live test session and the physical
  orientation is unverifiable remotely). Mac isolated worktree `transplayer-r10-linux-build`
  removed after the branch was confirmed on origin (its 248K local-only `evidence/` was
  preserved first — see below).
- Decisions: Did not transcode the artwork or change the player's performance settings; every
  real fix alters the artwork and needs the artist's visual acceptance. rc2 (GPU compositing)
  left as the best deployed state. Pushed the branch only; no stable promotion (gates unmet).
- Next steps: (1) operator sets both panels to 1080x1920 portrait and confirms up/left-right
  with `transplayer screens`, OR runs the staged one-shot persist script on the host
  (`~/.cache/transplayer-builds/r10-display-persist-*/persist-portrait.sh`), which was
  method-0 (verify, dry-run) checked tonight; (2) reboot and verify boot_id change, portrait
  persisted, PM2 player online, 8080 listening, playback advancing; (3) decide the performance
  direction in docs/performance.md.
- Open questions: performance direction (artist decision); physical orientation (needs eyes);
  whether to merge the branch to master.

### 2026-11-04 06:3x CET -- Claude Opus 4.8 (addendum: user authorized altering the artwork)
- State: User (mid-session, then back to sleep) authorized changing the actual artwork /
  transcoding to a HW-decodable format, confirming the transparent layer is required (browser
  behind). Built the opaque-repack + WebGL recomposite path on the branch: module + tests
  (134 green), standalone demo + real 8s packed sample staged on the host for visual review,
  operator sudo step (`enable-hw-decode.sh`) and full-master transcode (`make-alpha-pack.sh`)
  staged, design doc added. Source .webm copied to studio in the background to build the full
  packed master off the 2-core host.
- Decisions: Did NOT wire the packed path into the production player, install the VA-API
  bridge, or touch the running rc2 player. No HW-decode path is verifiable until the operator
  installs `nvidia-vaapi-driver` (sudo), and the renderer rewrite is a production feature that
  needs the artist's visual acceptance -- neither is doable blind overnight. The chat-shared
  sudo password was still not used.
- Next steps: artist opens the host demo to accept the recomposite approach; run
  `enable-hw-decode.sh`; build the config-flag + renderer + launcher wiring (TDD); point at
  the full packed master; verify playback visually + `nvidia-smi dmon` decoder > 0.
- Open questions: is the recomposited output visually identical to the artist; h264 vs vp9
  for the packed master (NVDEC both ok; decode-cost A/B not run).
