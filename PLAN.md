# Plan: transplayer r10 Ubuntu 26 exhibition deployment (formal host hcw)

Workflow: Hybrid (Section 7, hardware/real-time video) + Deployment (Section 14) +
Production change (Section 24). The performance fix is gated on the artist's visual
acceptance because every real option alters the artwork's video pipeline.

Formal host (NEW, 2026-11-06): `hcw@100.72.17.111` (Tailscale), hostname `hcw-MS-7D17` —
Ubuntu 26.04.1 LTS (resolute), kernel 7.0.0, GNOME Shell 50.1, Wayland. MSI MS-7D17 board,
12 threads, 14 GiB RAM, NVIDIA RTX 4060 (AD107) / driver 595.99.02. Display panels not yet
verified on this host. This REPLACES the retired 2-core Celeron `hcw@100.84.243.117`.

Branch: `HsienYu/transplayer-deploy` = `fix/r10-linux-optional-dependencies` (7b4257f) +
reCAPTCHA flag (d97eb95) + rc3 bump (f0da1dc). Master stays clean; no stable tag/promotion
(release gates below are not all passed).

## Status — new host hcw-MS-7D17 (rc3), 2026-11-06

- [done] Port the r8/r7b reCAPTCHA flag `--disable-blink-features=AutomationControlled`
  to the LIVE chrome-first path (`chrome-session.js`, not the unused Selenium `controller.js`).
  TDD red->green; full suite 134/134 on studio (Node 26.7.0). Commit d97eb95.
- [done] Bump `release.json` to `1.1.0~rc3` (rc2 payload + the flag). Commit f0da1dc.
- [done] Build `transplayer_1.1.0~rc3_amd64.deb` (290,272,932 B, SHA-256
  af2cbb4ba82c13ec482e7aad8c2f284125d0f44e8ef3929fd64b69b6a5177ef0): staged on studio from
  SHA-pinned toolchains (Electron 45.1.0, CfT/ChromeDriver 156.0.8078.80, nopecha 0.6.1
  intermediate, Node 24.22.2 / PM2 7.1.1), `dpkg-deb --root-owner-group --build` on the host.
  Bundle manifest SHA 3bad0b0e..., tools manifest SHA 2c279cf5.... Flag confirmed in the
  staged chrome-session.js; nopecha stripped from the final payload.
- [done] On-host preflight (read-only, clean baseline): Ubuntu 26.04.1 amd64, no prior
  transplayer/`/opt/transplayer`, dpkg --audit clean, 8080 free, apt simulate
  **0 upgraded, 10 newly installed, 0 to remove**. Deb + .sha256 + INSTALL.txt staged at
  `~/.cache/transplayer-builds/r10-rc3-20261106T143240Z/` on the host.
- [done] Installed `transplayer 1.1.0~rc3` via `sudo apt-get install --no-remove --no-upgrade`
  (user supplied the sudo password in session, 2026-11-06; apt plan was exactly 0/10/0 as
  predicted). Verified: `ii` state, `dpkg --audit` clean, both AppArmor profiles loaded
  (transplayer-r10-chrome/-electron), `/usr/bin/transplayer`, and the AutomationControlled flag
  present in the INSTALLED payload `/opt/transplayer/releases/r10.AppDir/app/chrome-session.js`.
- [done] Headless `transplayer configure --video .../stonesandelephants.webm --autostart`
  (over SSH as hcw): config.json written (start 775, 2160x1920), autostart entry
  `~/.config/autostart/transplayer-r10.desktop` (Exec `transplayer login`).
- [todo] ON-SITE (desktop session, needs eyes — NOT doable over SSH): `transplayer doctor`
  shows platform PASS but desktop NOT_READY, and `enable-extension` returns 78 over SSH. On the
  physical GNOME session: `transplayer enable-extension` + logout/login (loads the revision-3
  lease), set two 1080x1920 PORTRAIT panels in GNOME Settings + confirm with `transplayer screens`
  UP/LEFT/RIGHT, then `transplayer start` and watch playback/transparency; reboot to verify
  autoplay. Autostart `login` will correctly refuse until the extension is loaded and displays
  are portrait.
- [todo] reCAPTCHA: human-solve once per scene profile (user decision 2026-11-06); confirm
  /sorry/ clears after the first cycle. Flag alone does not remove abuse gating.
- [todo] RE-MEASURE dropped frames on this i5/RTX-4060 host BEFORE any packed-alpha work — the
  38% loss was a 2-core Celeron software-decode bottleneck; stronger CPU may make it moot.
- [todo] Warning-bar: operator to report the exact bar text if any (``--test-type`` deliberately
  NOT added — it re-introduces an automation signal).

## Status (prior — retired Celeron host, history)

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

### 2026-11-04 09:00 CET -- Claude Opus 4.8 (studio)
- State: User said the source `stonesandelephants.webm` is already on the formal host's
  desktop (`/home/hcw/Desktop/`), so the studio transfer is unnecessary. Stopped the
  background rsync and removed the partial file from `~/.cache/transplayer-transfer/`.
- Decision: Do NOT pre-build the full packed master on studio. When it is needed, run
  `make-alpha-pack.sh` against the on-host source. Caveat: doing that on the 2-core host
  competes with the live player, so run it while the player is stopped (e.g. during the
  maintenance/activation window), not during the live test.
- Next steps: unchanged from the entries above (artist accepts the demo -> enable-hw-decode.sh
  -> build the packed master on host during a quiet window -> wire the packed-alpha path).

### 2026-11-04 09:4x CET -- Claude Opus 4.8 (studio) -- reCAPTCHA diagnosis
- Symptom: the exhibition kiosk browser (the choreography behind the video) keeps landing on
  Google's `/sorry/` reCAPTCHA Enterprise interstitial instead of search results. User asked
  if it was caused by rc2 removing the Chrome infobar; it is NOT (that flag is local-only).
- Root facts (all verified read-only on host 100.84.243.117):
  - Live backend is `chrome-first` (runtime.py:247). It spawns Chrome manually in
    chrome-session.js and NEVER loads a browser extension.
  - The 7 scene browsers use FIXED ids 13..19 (hardcoded in web-process-new.js), each with its
    own profile `~/.local/share/transplayer/profiles-r10-basic/se_<id>`. Nothing in the app
    wipes these; they PERSIST across restarts (only tests rmdir profiles). So "use a fixed
    profile" is moot -- they are already fixed/persistent.
  - Every se_* profile already has Google cookies (AEC,NID,SEARCH_SAMESITE,SNID,_GRECAPTCHA,
    __Secure-STRP) but NONE has `GOOGLE_ABUSE_EXEMPTION` -- i.e. nobody ever solved the
    challenge in these profiles, so Google keeps gating.
  - The browser is NOT detectable as automated: `navigator.webdriver=false`, normal UA, 5
    plugins, en-US. So there is no free "hide automation" fix to restore.
  - The old `webdriver` backend loaded `nopecha-0.6.1.zip` (auto CAPTCHA solver) +
    excludeSwitches(enable-automation); `chrome-first` has neither. nopecha was DELIBERATELY
    removed from the r10 build (package_build.py:102 unlink, asserted absent in
    installer_cases.py:670, under a "license provenance" gate) and the zip is NOT in the repo,
    NOT in git history, NOT anywhere on studio, and NOT in the deployed AppDir. It only exists
    on the legacy build machine (build-portable.py sources it from --legacy node_modules).
- Approach (a) "re-enable nopecha" is BLOCKED on: (1) the extension artifact is gone from here;
  (2) re-adding it reverses a deliberate license/distribution decision; (3) reCAPTCHA
  Enterprise + exhibition volume almost certainly needs nopecha's PAID tier + API key (a paid
  decision -- not mine to make). Even then, automated solving is ToS-gray.
- User authorized restarting the piece ("可以重啟城市沒關係") -- so a deploy+restart is allowed
  once a workable fix is chosen.
- Realistic levers (awaiting user decision): (b) human-solve the reCAPTCHA once per scene via
  RustDesk -> GOOGLE_ABUSE_EXEMPTION persists in the (already persistent) profile for a while;
  (c) slow the search cadence / fewer scenes to reduce challenge frequency; (d) route the
  choreography through Google's official Programmable Search API (ToS-clean, no captcha, but
  changes the on-screen aesthetic and has quota/cost). No code changed this round (read-only).

### 2026-11-04 09:3x CET -- Claude Opus 4.8 (studio) -- host retired / powered off
- The exhibition side is replacing this 2-core Celeron host with a more powerful machine, so
  the user asked to shut it down ("先關機吧 ... 展覽方要換成另一台效能比較好的電腦"). Powered
  it off over SSH (`sudo -S systemctl poweroff`, user-authorized hcw password); ping + SSH both
  confirm offline. The box is retired; `100.84.243.117` will no longer respond.
- Nothing lost: all work is on branch `fix/r10-linux-optional-dependencies` (tip 6709c79) and
  on origin. For the NEW machine deploy: (1) RE-MEASURE dropped frames first -- a stronger CPU
  may remove the need for the opaque-repack + WebGL recomposite path (that whole effort was
  driven by the 2-core software-decode bottleneck); (2) the reCAPTCHA issue is Google-side and
  is NOT fixed by faster hardware -- carry the decision forward (human-solve-once / slower
  cadence / Programmable Search API / paid nopecha); (3) redo display portrait rotation +
  persistence on the new machine; (4) install nvidia-vaapi-driver there if the packed-alpha HW
  decode path is still wanted. Memory updated: shared/transplayer-formal-host.md marked RETIRED.

### 2026-11-06 15:39 CET (14:39Z) -- Claude Opus 4.8 (studio, new host hcw-MS-7D17 deploy)
- State: New formal host hcw@100.72.17.111 (hcw-MS-7D17, Ubuntu 26.04.1, RTX 4060, 12t/14GiB)
  is the replacement for the retired Celeron. Ported the r8 AutomationControlled reCAPTCHA flag
  to the live chrome-first path + TDD (134/134). Bumped to rc3. Built and staged
  transplayer_1.1.0~rc3_amd64.deb (SHA af2cbb4b...) on the host at
  ~/.cache/transplayer-builds/r10-rc3-20261106T143240Z/ with INSTALL.txt. Preflight clean,
  apt simulate 0/10/0. Branch HsienYu/transplayer-deploy pushed.
- Decisions: reCAPTCHA = human-solve-once per scene profile (user chose 2026-11-06); flag is
  defense-in-depth, not a /sorry/ fix. Did NOT add --test-type (re-adds automation signal).
  Maintainer = chenghsienyu <chenghsienyu@aim.com> (git author; RC field build, not a stable
  release). Build-staged on studio (no dpkg-deb on Arch) then dpkg-deb on the Ubuntu host.
- Next steps: operator runs the sudo apt install (0/10/0), then on-site setup/rotation/
  extension/autostart/visual verify + reboot-autoplay; re-measure dropped frames on this
  stronger host before any packed-alpha work; report the warning-bar text if one shows.
- Open questions: exact display panels on the new host (not verified); whether to merge this
  branch to fix/r10 / master (user's call); lintian/license/vuln release gates still open.

### 2026-11-06 15:54 CET (14:54Z) -- Claude Opus 4.8 (studio) -- addendum: installed + configured
- User supplied the hcw sudo password in session and authorized the install ("安全性問題不用在意
  這是展覽用的作品"). Installed rc3 (0/10/0 as predicted), verified ii/audit/AppArmor/flag-in-payload.
  Ran headless configure (video + autostart). Password used transiently via sudo -S; NOT written
  to any file/commit/memory. (PLAN note from the retired host still suggests rotating it.)
- Remote boundary reached: desktop NOT_READY over SSH (enable-extension -> 78). Extension enable +
  logout/login, GNOME portrait rotation, and visual playback/reCAPTCHA acceptance are on-site only.
- Branch HsienYu/transplayer-deploy pushed (9ad3086 + this PLAN update). Suite 134/134 on studio
  Node 26 AND host Node 24.22.2.

### 2026-11-06 16:49 CET (15:49Z) -- Claude Opus 4.8 (studio) -- reboot verified: autoplay + 0 dropped frames
- Rotated both ASUS VP247 panels to portrait (Mutter ApplyMonitorsConfig applied live but did
  NOT persist; wrote ~/.config/monitors.xml by hand, rotation=left x0/x1080, backup .landscape.bak),
  then rebooted (user asked, user sudo). Post-boot: doctor platform+desktop PASS, displays persisted
  portrait 2160x1920, extension ACTIVE, PM2 player online, 8080 listening, full Electron tree
  (video+web-process+guard+gpu+audio). out.log PLAYBACK currentTime 0->85s, frames 176->2305,
  **dropped:0** (Celeron was ~38%) -> packed-alpha HW-decode rework likely unnecessary on this host.
- Needs on-site eyes only: video visible/transparent/click-through, upright + correct physical L/R
  (both set 90/left; flip in GNOME if swapped/upside-down), 775 start/loop behaviour, Google search
  results + first-time reCAPTCHA human-solve. Watch error.log MESA dri_gbm Permission denied (AppArmor
  userns on GPU loader; not blocking since 0 drops).
