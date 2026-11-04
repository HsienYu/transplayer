# Experiments
- `gpu-playback/` — **active, comparison complete; candidate performance blocked**, time-boxed to one approved
  maintenance session. Compares installed Electron's disabled/default GPU
  rendering using identical transparent VP9 media and isolated profiles.
  Not loaded by production; no package or film changes. See
  [the approved protocol](../tests/manual/ubuntu26-installation.md#gpu-comparison-maintenance-run).
  Standalone results do not establish full artwork performance or visual acceptance.
  The first run aborted after normal stop because the immediate zero-process
  gate saw AppDir processes still present. No A/B window ran. Later inspection found
  zero remaining processes and restored desktop state; unchanged RC playback
  was restored and fresh frame progress verified. Revised runner records
  shutdown identities and bounds settling to10 seconds, with fail-closed tests.
  A new SHA-versioned staging/preflight is required for the approved retry.
  The revised 2026-11-04 staging passed four SHA checks but its preflight
  refused unreadable `/proc/1636/exe` (owned user systemd). No stop/probe ran.
  Do not skip protected live processes or run the graphical diagnostic as root.
  A subsequent read-only check verified unchanged RC frame progress and lease.
  A revised opt-in sudo/readlink path and `operator.sh` now have15 Python
  tests and verified five-file staging at `r10-gpu-ab-20261104T014356Z`.
  The operator ran it: both preflights and the maintenance gate passed,
  but the software probe hit its55-second watchdog with no result.json.
  The GPU round never ran. Original hashes and initial0→5→10s recovery
  progress passed; later log gaps mean continuous healthy playback is not
  established. A subsequent20-second observation showed390→405s progress
  but47.47% dropped frames between the two latest playback records.
  Diagnostic phase logging now passes six new VM cases (full116 Node tests,
  including the15-case Python wrapper), not a root-cause fix or hardware result.
  The operator ran021802Z: its phase trace stalled at Media.enable421ms,
  watchdog55055ms, before overlay-load or any video. Electron45.1.0's official
  debugger docs confirm replies can wait for navigation; awaiting Media.enable
  before loadFile creates this diagnostic deadlock. It is not GPU evidence.
  Original hashes/initial recovery passed; later8s observation saw280→285s
  progress with severe drops still present. All16 evidence files were retrieved
  and SHA-verified. The correction loads the page, attaches/enables Media,
  then invokes runProbe, leaving seek/play ordering and55/70s limits intact.
  Three regression cases first failed then passed (full119 Node tests).
  New `r10-gpu-ab-20261104T023354Z` staging passed five SHA and both-host
  syntax checks. The operator's023915Z evidence now completes both rounds
  (exit0) and original-RC recovery. All23 evidence files were independently
  SHA-verified. Software80/692 drops (11.56%),20.53 submitted frames/wall-s,
  CPU93.09%; default GPU12/739 (1.62%),24.17 submitted frames/wall-s,
  CPU80.54%. Both still use VpxVideoDecoder/non-platform software decode.
  Initial partial/opaque alpha samples match; actual desktop transparency,
  click-through/audio and full controller/search load are not established.
  The operator subsequently confirmed probe transparency/no black/flicker/
  click-through. Production main-path TDD passed and GPU/dialogs rc2 was
  built and installed through the approved backed-up operator; no prototype
  code was copied into the production entrypoint. Its full-controller90s
  observation still lost529/1392 frames (38.00%) withCPU97.94% busy.
  Thus the standalone comparison is complete, but full-artwork performance
  remains blocked; audio/UI/lifecycle/soak and release gates are pending.
  Do not rerun a maintenance experiment without new interruption approval
  or treat the isolated1.62% as production performance.

- `captcha-attach/probe.js` — **promoted concept, historical prototype**.
  The Chrome-first attachment approach was rebuilt with lifecycle,
  profile-ownership and loopback-boundary tests in `chrome-session.js`
  and integrated through `controller.js` for r9. The original probe is
  retained for provenance, is not loaded by production, and hard-codes
  historical r8/staging paths. Do not run it over an active installation.
  Actual observations and limitations are recorded in
  [the Ubuntu deployment protocol](../tests/manual/ubuntu25-r8.md).
