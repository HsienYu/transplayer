# Ubuntu 26.04 installation acceptance
Status: **GPU rc2 installed and payload verified; full-workload performance blocked**.
Target: Ubuntu 26.04 LTS amd64, GNOME 50 / Ubuntu Dock, two portrait
1080×1920 displays. Existing Ubuntu 25.10 r9 exhibition is out of scope.

> Current state (2026-11-07 UTC): the authoritative version is now
> `1.1.0~rc8` — see `packaging/installer/release.json`. rc8 was built,
> installed and live-verified on the reference host MSI MS-7D17 (version
> `1.1.0~rc8`, reboot autoplay, 0 dropped frames).
> The dated runbook entries below record earlier `1.1.0~rc1`/`~rc2`
> candidates and are kept verbatim as the chronological evidence log —
> do not read their SHA-256/version values as the current package. Full
> Ubuntu 26.04 acceptance gates (soak, licence/vulnerability/lintian
> audit) remain open; rc8 deployment is not the completed acceptance run.

## Before testing
Use a disposable new test installation with the user's maintenance approval.
Keep the installer, checksum, full logs and previous package for recovery.
Do not use personal browser profiles or credentials. Record actual UTC
timestamps and hardware; never copy historical r9 results into this report.

## First-install operator runbook
This run is authorized for the new formal host only. Keep raw logs and
account/host paths in private evidence, not in this tracked document.
The candidate remains Debian `1.1.0~rc1`; its SHA-256 is
`41df1ac6c98edeaa39346a1aa0912a3f8e569bb73368b7ad3aa1375b87b145ac`.
It includes the explicitly recorded uncommitted Linux build correction;
do not describe it as a build from clean master.

1. Before sudo, verify Ubuntu26.04/amd64, exact candidate SHA/version,
   empty `dpkg --audit`, no prior Transplayer package/configuration/target
   paths, and zero listeners on8080. Stop on the first mismatch.
   Package absence is the known clean-install baseline; installed executable
   paths cannot be active when those paths do not exist. The package's
   root preinst additionally scans all users' executable identities.
2. Save private package versions, apt manual/auto marks, dpkg status and
   apt extended state. Repeat actual-package simulation using
   `apt-get --simulate --no-remove --no-upgrade install` with the candidate:
   require exactly0 upgraded,63 newly installed,0 removed and63 `Inst` actions.
3. The operator runs the reviewed one-run recipe in the formal machine's
   own terminal as the exhibition user. Never send a sudo password through
   chat or log input. The recipe defaults to `--check`; `--install` explicitly
   requests sudo, backs up package state and `/etc/apparmor.d`, records loaded
   policies, and repeats the preflight before installation.
   The backup is not a full filesystem image or a dependency rollback.
4. Install with `apt-get --no-remove --no-upgrade install`, retaining its
   interactive confirmation. If its final plan differs from0/63/0, answer
   no and stop. Save complete output privately. Do not force dpkg, remove a
   maintenance marker, launch a GUI as root or add an insecure sandbox flag.
5. Require exact `install ok installed`/`1.1.0~rc1`, clean dpkg audit and
   package verification, absent maintenance marker, both exact AppArmor
   profiles loaded, zero package-owned processes and zero8080 listeners.
   These are installation checks only, not hardware acceptance or lintian.
6. Recovery baseline is no Transplayer package, not a prior r10 binary.
   If configuration fails, retain logs and state and inspect the actual
   error; do not automatically retry, purge or autoremove dependencies.
   Once configured and after normal stop/`prepare-maintenance` in every r10
   account, simulate removal of only `transplayer`. Require one removal and
   no other actions before separately executing standard package removal.
   The63 additions include Transplayer itself. Keep its newly installed
   dependencies, media, user config/profiles and
   the verified candidate for reinstall. Removal deliberately retains the
   launch gate; successful reinstall/configure clears it. Do not restore
   dpkg status over live package files or claim exact OS rollback.
7. Installation success does not authorize an uncoordinated logout/reboot.
   Proceed through all sections below with actual media and physical
   observations. Resolve lintian, license and vulnerability gates as well.
   Only after every release gate succeeds may Git be updated for a stable
   release; rebuild and revalidate the real stable-version package instead
   of renaming the rc1 artifact.

## Installation and setup
1. Build the real package on Linux; run lintian, inspect dpkg contents,
   ownership, dependencies, licenses and SHA-256. A synthetic bundle test
   is not a release artifact.
2. Install on a clean account using apt or the available graphical package
   installer. Require zero GUI/player launches from root maintainer scripts.
3. Open Transplayer Setup as the exhibition user. Cancel once: require no
   config/autostart changes. Retry with a readable UTF-8 video path containing
   spaces. Require 2160×1920, 780-second original media and start at 775.
4. Reject wrong OS/architecture, missing video, foreign configuration and
   conflicting local GNOME extension without overwriting any user files.
5. Enable the extension, follow the explicit logout/login prompt, then
   require loaded GNOME 50 extension and matching restricted Status revision.
   Do not force logout from the wizard.
6. Validate wrong display layout is blocked. Correct both displays using
   GNOME Settings; require two portrait displays and combined 2160×1920.
   Use the setup window's display-settings entry and direction/side test
   patterns (CLI: `transplayer screens`) with playback stopped. For each
   independent left/right rotation pair, 90/90, 270/270, 90/270 and 270/90,
   require upright UP arrows and correct physical LEFT/RIGHT labels.
   Seam alignment is not an acceptance requirement. Confirm each actual
   fullscreen window fills the intended monitor. No film rotation or
   automatic changes to GNOME rotation/monitors.xml are permitted.
   Verify reversed connector enumeration still maps by desktop position;
   swapped physical sides must be corrected in GNOME, not guessed by cable.
   Reject mirrored/overlapping/gapped/vertically offset layouts, wrong
   dimensions and non-100% scaling. Test Escape, either close button and
   the 120-second timeout: all pattern windows must close. Change display
   arrangement/unplug a display during the test: require all windows close
   with a retry message, leaving system settings as the operator chose.
   Verify the test refuses an active lease/controller, prevents concurrent
   normal start/package maintenance, and leaves no test process behind.
   Reboot in an approved window and repeat visual checks to verify GNOME
   retained each display's independent rotation and placement.

## GPU candidate upgrade (built; installation not executed)
The operator confirmed the standalone GPU probe's transparency, no black
background/flicker and click-through, and selected GPU for the release direction.
Source candidate `1.1.0~rc2` removes the global GPU disable and includes the
dedicated Chrome dialog changes. This is not yet an installed/stable release.
Before a separately approved interruption, build into a new directory,
record source base/patch/archive SHA and actual package SHA; retain the
verified original rc1 package and its SHA above as the rollback binary.
Record and verify private config/setup, autostart state, installed payload,
package state and policy backups before normal stop/prepare-maintenance.
Require zero owned descendants, zero8080 listeners, inactive desktop lease,
restored panel/Dock and both maintenance locks before package replacement.
Unreadable process identities must fail closed; use only the reviewed
operator-assisted inspection, not root GUI or ignored permission errors.
Simulate the actual upgrade: expect exactly one Transplayer upgrade,
zero new dependencies/removals and no other package actions. Stop on mismatch.
Operator authentication and standard package installation remain local;
do not apply the first-install absence gate or its `--no-upgrade` recipe.
Verify every installed payload file against the new deb, including modes/
root ownership, exact rc2 version, both AppArmor policies and clean dpkg state.
Only then normal-user start and record775→0, full780-second cycle,13 searches,
audio, original geometry/scrolling, browser chrome, interval dropped frames
and CPU with the full controller workload, then representative soak.
Rollback, if needed, is normal stop/maintenance and an explicitly simulated
single-package rc2→rc1 downgrade using the retained SHA-verified package;
preserve failed logs, user data and preferences, never purge/autoremove.
Restored rc1 must be independently checked and show new playback progress.
Binary downgrade does not imply reversal of dedicated browser preference
changes; keep the pre-upgrade private profile baseline if an exact profile
restore is required, and perform it only while fully stopped.

### Candidate build evidence — 2026-11-04T03:26:23Z UTC
The operator confirmed the standalone visual behavior and selected default
GPU acceleration. Production `main.js` now keeps Electron defaults; the
new actual-entrypoint VM policy regression was red, then seven cases passed.
Both Mac and Ubuntu full suites passed126 Node tests,0fail/0skipped;
Ubuntu's installer suite separately passed52 Python tests (OK).
Complete local red/green/full logs are in ignored worktree
`evidence/r10-main-gpu-*.log`.

Private versioned build root: `r10-gpu-rc2-20261104T030719Z`.
Initial packaging timed out at600 seconds and left an invalid2,902-byte
artifact; it and full failure logs are retained, not overwritten or installed.
No build process remained at subsequent inspection. Reverified the complete
source/staging manifests and repackaged into a separate `pack-zstd/` output
using dpkg1.23.7's supported zstd level1,maximum1thread;20.95 seconds through
packaging/verification. This compression change does not modify the payload.
Official option reference:
https://manpages.debian.org/testing/dpkg/dpkg-deb.1.en.html

Valid candidate: `pack-zstd/transplayer_1.1.0~rc2_amd64.deb`,
397011210 bytes, SHA-256
`d1d5684bad61204b11df03f4d40c891c72733a2929622f473888ee926d108f6e`.
Actual package payload matched all3226 staged files by contents/modes and
root ownership. Metadata, hook syntax, Desktop Entries and AppArmor
preprocessing passed; no kernel policy change was made.
Actual apt simulation:1 upgraded,0 newly installed,0 removed,108 not upgraded;
the only action is Transplayer. This is not an executed upgrade.
Source archive SHA-256:
`7b08d3d1a14eb12c59c5123c5eae98ac9a024c21e8fb5b9a718e6dcad0e38036`;
base ab8bf5d plus explicitly recorded uncommitted patch and per-file hashes,
not a clean release commit. Secret scan passed.
All27 small evidence files were retrieved in a SHA-verified archive under
main-checkout `release-builds/r10-gpu-rc2-20261104T030719Z/retrieved-evidence/`.
Installed main SHA still matches original rc1. No stop/install/profile
mutation, source commit/push/tag/Release or stable promotion occurred.
Fresh upgrade-run approval/operator authentication, private backup and
executable runbook remain prerequisites. Lintian, license/security,
full-artwork/audio/performance/lifecycle/soak gates remain pending.

### Upgrade operator staged — 2026-11-04T03:43:14Z UTC
The user approved this short interruption and upgrade. New private staging
`r10-upgrade-20261104T033322Z/` contains `operator.sh`, `upgrade.py` and
SHA-pinned copies of the existing process-inspection/payload helpers.
All five file hashes and Python/Bash syntax matched on both machines.
Fifteen fixture tests passed on Mac and Linux: exact single-package upgrade,
hostile/extra/removal actions, unsafe/hardlinked backup entries, metadata-only
symlink preservation, tar roundtrip and fresh-log progress after counters reset.
Initial plan-gate red and progress-interface red outputs are retained, not
presented as live deployment failures. Local evidence is under main-checkout
`release-builds/r10-upgrade-20261104T033322Z/`.

Run in the normal exhibition account's Ubuntu desktop terminal:
`bash "$HOME/.cache/transplayer-builds/r10-upgrade-20261104T033322Z/operator.sh" --upgrade`.
Do not use the old A/B or first-install operator. Authenticate only at its
real sudo prompt outside logging; no outer sudo, pasted password or SSH
credential assumption. APT retains its native confirmation: require only
1 Transplayer upgrade/0 new/0 removals or answer no.
The entrypoint first requires fresh original playback progress, both package
hashes, original full payload and exact apt simulation before stopping.
After normal stop/preparation, require zero owned processes/8080/lease,
panel restored and full root process scan. Hold the account lock, take and
verify a private tar of config, stopped dedicated profiles and logs, plus a
separate package-state/policy baseline. Preserve symlink metadata without
following targets; reject foreign/special/hardlinked entries and backups over
4 GiB/50000 entries. System backup is not a disk image.
Release the shared system lock before dpkg hooks take it exclusively; the
account lock remains held. Repeat simulation and activity scan immediately
before standard apt update. Hooks still enforce all-account maintenance.
Postcheck exact rc2 payload, config hashes, AppArmor and idle desktop before
normal-user start. Only new log bytes/counters count as restart progress.
Expected markers: `UPGRADE_PREFLIGHT_PASS`, `USER_BACKUP_PASS`,
`STOP_BACKUP_GATE_PASS`, `INSTALLATION_CHECK_PASS`,
`GPU_CANDIDATE_RUNNING`, `UPGRADE_COMPLETE`.
Any failure stops without forced dpkg, removed markers, automatic downgrade
or an unreviewed restart; preserve the printed attempt directory for review.
Rollback remains the reviewed stop/maintenance, exact old-package simulation,
operator-confirmed standard downgrade and independent verification above;
partial package failures require review before reconfiguration/downgrade.

SSH sudo cache was unavailable. At this handoff no live operator preflight,
backup, stop, apt upgrade, rc2 start or rollback has been executed.
The original rc1 remains installed; full artwork/audio/UI/performance/soak
acceptance and stable/Git release remain pending.

### Upgrade verified; performance still blocked — 2026-11-04T04:00:57Z UTC
Operator attempt `attempt-20261104T034750Z-DG1Zqz` completed preflight,
2363-entry user backup, stop/backup gates and native apt confirmation:
exactly1 Transplayer upgrade/0new/0remove/108held. rc2 configured,
3226 installed payload files matched contents/modes/root ownership, both
AppArmor profiles loaded, maintenance marker absent and dpkg audit clean.
Independent SSH confirmed rc2 and main SHA
`0c281847b3aff8b633fac5b9635343fb226a6dc0f632258405889b959c54c2a3`,
without the global acceleration disable. Config/setup hashes are unchanged.
Fresh start showed775→0,frames51→176,dropped0→1. These are startup results,
not a full-cycle/audio/UI/performance acceptance.

Independent03:52:48–03:54:18 UTC observation with the actual controller/
Chrome workload:90.0183 wall seconds, playback records145.258317→200.187486,
frames3761→5153,dropped453→982. Record-interval loss529/1392=38.0029%;
system CPU97.9358% busy. This remains severe and blocks performance acceptance.
Do not replace it with the isolated probe's1.62% result or compare the old
48% observation as a controlled same-workload A/B. Playback records are
media-time5-second buckets, not wall-synchronized screen FPS or a soak.
The initial exact-argv browser counter incorrectly reported0 for collapsed
process titles; that field is invalid. A corrected read-only role observation
confirmed Chrome/GPU/renderers present, not13 independent browser instances.
One subsequent5-second sample attributed118.98% of one CPU to the Electron
video renderer. It does not separate decoding/compositing costs or establish
the production media decoder/hardware acceleration path.

The608143360-byte private user tar (2363 entries) and2467840-byte package/
policy tar were independently SHA-reverified and retained on the host.
Twenty-two small evidence files were retrieved in a SHA-verified archive to
main-checkout `release-builds/r10-upgrade-20261104T033322Z/installed-evidence/`;
no full browser backup or preferences contents were retrieved.
`installed-verification.json` independently recomputes the measurements.
No follow-up stop/restart/rollback or source commit/push/tag/Release occurred.
Keep the GPU candidate running while investigating CPU contention; actual
audio/browser chrome observations, full timeline/lifecycle/soak and other
release gates remain pending. No stable promotion is implied.

### Operator audio/browser chrome confirmation — 2026-11-04T04:06:37Z UTC
The operator reports normal audio and that the warning information bar,
translation offer and Download Chrome bar have all disappeared on installed
GPU rc2. Record these as observed manual acceptance of current playback,
not an automated UI check. No separate forced Chrome replacement, unclean
shutdown/reboot, permission-page or viewport/choreography test was reported.
Hiding the sandbox warning does not resolve the underlying sandbox review.
The38.00% record-interval dropped-frame result and other release gates remain
open. No additional host mutation, restart or stable/Git promotion occurred.

## Dedicated Chrome dialog acceptance
Use only a versioned candidate and its claimed, unlocked exhibition profile.
Never mutate a running browser's preferences or an unrelated personal profile.
Before initial/replacement spawn, require safe private `Default/Preferences`
with `translate.enabled=false`, password saving/auto-sign-in/automatic passkey
upgrade and address/card autofill disabled; notification/location/camera/mic
defaults are block (2). Preserve unrelated preferences and existing site
exceptions. Corrupt/nonobject JSON, unsafe nested nodes, links, unsafe file
permissions/ownership and live locks must refuse startup without rewriting
the affected file. Writes are private and atomic; do not print profile data.
Use a synthetic loopback page to verify permission states and a JS confirm
being dismissed on the next applicable WebDriver command. Inspect browser
chrome visually for translation and information bars on initial/replacement
launch; page DOM inspection cannot establish absence of browser chrome.
Keep certificate/Safe Browsing protections; website cookie/CAPTCHA UI is not
covered. Record actual Chrome version and the UI observations separately.

## Playback and supervision
1. Start once, then start again: require one PM2 player, one lease and one
   loopback 8080 listener, no bounded smoke timeout.
2. Witness transparency, click-through, audio, native Dock,
   13 searches and original window/scroll choreography. Observe startup
   775→0 and a second reset after the full 780-second cycle. Save frame counts.
3. Stop through the supervised Stop entry. Require no owned descendants,
   debugger/8080, released lease and restored panel/Dock.
4. Separately test player crash recovery, Chrome stale-lock recovery,
   extension disable and parent disconnect; signal only identified owned
   PIDs in an approved test window. Record recovery delay and all failures.
   For Chrome crash recovery, verify the owned browser command includes
   `--hide-crash-restore-bubble`, terminate only the identity-checked exhibition
   Chrome PID, and retain its dedicated profile and stale lock untouched.
   Observe automatic replacement at the next applicable timeline event;
   require loaded images and continued scrolling with **no Restore pages /
   Restore session / Chrome didn't shut down correctly bubble**, no manual
   dismissal, and no restoration of old tabs. Inspect browser chrome visually:
   a page DOM query cannot prove the browser-level bubble is absent.
   With the candidate's Chrome for Testing, also inspect initial and
   replacement browser chrome: require no testing disclaimer/Download Chrome
   bar and no unsupported-command-line warning bar. The candidate adds
   `--disable-infobars`, supported for noninteractive bars by Chromium156
   `components/infobars/core/infobar_manager.cc`. Confirm the increased page
   viewport does not break the original rectangles/scroll choreography.
   Hiding the existing setuid-sandbox flag warning does not prove that flag
   is necessary or that sandbox acceptance has passed; evaluate separately.
5. Opt in to autostart, perform a coordinated reboot, and witness playback
   without stale desktop authentication or keyring prompt. Repeat with
   autostart off. Do not change GDM or keyring automatically.
   Also repeat startup from an unclean exhibition-profile shutdown in an
   approved test window: require no restore bubble after login and real
   playback progress. Do not pull power on a production installation merely
   to exercise this case; record the exact simulated failure and do not call
   it a physical power-loss test.

## GPU comparison maintenance run
Diagnostic spike only; the operator approved a short playback interruption.
Do not replace installed files, change GNOME/driver settings, transcode media,
touch browser profiles, or promote a successful probe directly to production.

1. Stage SHA-verified `experiments/gpu-playback/` in a new private evidence
   directory. Run `python3 run.py --check`: require the exact installed main
   SHA recorded by the probe, one owned Xwayland with readable authority,
   autostart off, valid owned config, matching2160×1920 desktop and active
   playback. Never print authority contents or raw process environments.
   An earlier 2026-11-04 retry was blocked before stop: the unprivileged
   process snapshot cannot read `/proc/1636/exe` (owned user systemd).
   Retain the full PermissionError and do not skip unreadable live processes
   or run the graphical runner as root. Resolve a reviewed privileged
   read-only inspection approach with the operator before another attempt.
   Revised opt-in approach: `bash operator.sh --check` in the exhibition
   user's desktop terminal authenticates with `sudo -v` outside logs, then
   runs normal-user Python with `--sudo-process-inspection`. Only otherwise
   unreadable executable links use fixed noninteractive
   `/usr/bin/sudo -n /usr/bin/readlink --zero -- /proc/<numeric-pid>/exe`.
   No root Python/GUI, shell interpolation of PID, password stdin/file or
   sudoers changes. Each privileged read is bounded by2 seconds and the
   scan/settling deadline, and is recorded privately. PID/UID/parent/start
   ticks must agree before/after lookup; errors still refuse continuation.
   `bash operator.sh --run` first gates on the same preflight and only then
   performs the already-approved comparison/restoration. It saves complete
   ordered stdout/stderr with pipefail under a new private `operator-*`
   directory. Require `PREFLIGHT_PASS`, both successful round summaries,
   `RESTORED_ORIGINAL_RC` and `AB_RUN_COMPLETE`; any mismatch stops.
   Sudo cache is terminal-specific; successful desktop sudo does not give
   SSH authorization. Re-authenticate only in the operator's terminal.
   Earlier014356Z and021802Z operator runs failed at the software watchdog.
   The second trace identified Media.enable before navigation as the blocker.
   Do not rerun those entrypoints. Corrected023354Z now completed its
   approved comparison; do not rerun it without a new maintenance approval.
2. `python3 run.py --run` saves existing config/setup and playback logs before
   normal `/usr/bin/transplayer stop`, then `prepare-maintenance`. Require
   zero current-account AppDir processes, zero8080 listeners, inactive
   desktop lease and restored panel. Stop at the first mismatch.
   Revised runner allows up to10 seconds of settling after stop,
   prepare-maintenance, each probe exit and before restoration. Poll every
   250ms (plus bounded inspection time); retain private JSON observations
   with PID/parent/start ticks/executable, listener count and desktop state.
   Inspection errors, late observations and timeout refuse continuation.
   Keep the strict immediate idle gate at each probe entry; do not kill
   unidentified processes or relax any state requirement.
3. Hold installed account/system locks for the whole comparison. Each run
   uses the installed immutable Electron, its normal X11/transparent and
   setuid-sandbox switches, a new private userData and the same media from
   second150:5-second warm-up then30-second sample. A calls
   disableHardwareAcceleration before ready; B retains default acceleration.
   Use a matching full2160×1920 checkerboard background and click-through
   transparent overlay, muted audio, no controller/search/desktop lease.
   Corrected initialization must load the local probe page before debugger
   attach/Media.enable, then enable Media before invoking runProbe or assigning
   the video source. Electron45.1.0 documents that pre-navigation debugger
   commands may not resolve until navigation. Verify phase order
   overlay-load→overlay-ready→media-enable→renderer-invoke; navigation or
   Media.enable failure must stop, never fall back to uninstrumented playback.
4. Record frame deltas and wall/media progress, rVFC submitted-frame counters,
   CPU samples, GPU feature status and allowlisted Media decoder properties.
   Require positive frame/media progress and mixed transparent/opaque source
   pixels in both modes. These checks do not prove the actual window's alpha
   presentation, click-through, audio or complete artwork performance.
   Ask the operator to observe the checkerboard showing through both modes.
5. Each probe has its own55-second watchdog and70-second parent timeout.
   The local diagnostic revision records `progress.jsonl` with private0600
   exclusive creation, elapsed time, fixed phase names and numeric/boolean
   media state. Capture ready, background/overlay loading, Media.enable,
   metadata, seek, play, warm-up, measurement and watchdog's last phase.
   Do not store media URLs, arbitrary console text, sourceId or frame objects.
   A missing result must remain a failed round, not a zero-drop success.
   Preserve the existing seek/play ordering and deadlines until actual
   phase evidence supports a correction.
   On timeout terminate only the newly started owned process group, retain
   failure logs and stop the comparison. Require zero AppDir processes and
   unchanged config/setup/main SHA between rounds.
6. Rollback is to the untouched installed RC: after probe cleanup and lock
   release require no AppDir processes, idle8080, restored panel/inactive
   lease and unchanged original hashes, then `/usr/bin/transplayer start`.
   Confirm fresh playback progress after at least10 seconds. If any gate or
   recovery fails, preserve state and report that playback is stopped;
   never force package changes, restart GNOME or reboot to hide the failure.
   Keep private evidence and isolated probe profiles for review.

## Package lifecycle
1. With playback active, attempted upgrade/removal must refuse without
   changing installed files. Exercise concurrent start versus maintenance.
2. Stop normally and use `transplayer prepare-maintenance` in every r10
   account; require the isolated PM2 daemon stopped and owned autostart off.
   Do not run `status` afterwards (it can start the daemon again).
   Upgrade, configure retry/failure and rollback to a retained
   package; require checksums, AppArmor policy, launchers and settings agree.
   dpkg is not an application-wide atomic transaction.
3. Prepare maintenance again, remove and purge package; require video,
   config, browser profiles, logs and backups retained. Reinstall and inspect
   retained state before opting back in. Never clean unrelated accounts.
4. Test diagnostics export: no credentials, raw PM2 environment, private
   browser contents or unmasked account/home paths.
5. Run a representative continuously recorded soak with resource, error,
   restart and recovery counts. Record manual visuals separately.

## Evidence
### 2026-11-04T04:23:25Z UTC — read-only CPU contention diagnosis
Installed rc2 continued playing; no stop, restart, debugger attachment,
profile write, GPU flag or installed-source change. A30.0046-second sample
at04:16:35–04:17:05 UTC measured98.5461% system CPU busy. In three10-second
intervals, one-core-normalized CPU was69.97/88.54/90.76% for the video
renderer,92.46/71.63/70.27% for Chrome plus WebDriver,20.09/23.91/23.69%
for GNOME Shell. New Chrome processes are included; processes that both
start and exit between snapshots remain unaccounted for.
The renderer's busiest ThreadPoolForeg thread ran12.3080s and waited on
the runqueue15.4415s; its busiest CodecWorker ran10.6426s and waited14.0865s.
These are scheduling counters, not function-stack attribution or proof of
the production decoder identity. CPU contention is directly observed;
the exact decode/alpha/composition split still needs controlled profiling.
Playback records315.246242→325.086862s show121/254 drops (47.6378%).
They are media-bucket records, not synchronized screen FPS or an A/B
regression against the earlier38% sample. Four GPU endpoint samples had
7/40/31/35% total utilization and0% decoder/encoder; available memory stayed
above11GiB, swap unused. Main/config/setup hashes were unchanged.
Private evidence: main-checkout
`release-builds/r10-upgrade-20261104T033322Z/cpu-readonly-20261104T041632Z/`,
including the executed sample.py, measurement.json, empty stderr.log and
independently recomputed verification.json. Measurement SHA-256:
`f3f5966c24d2147845b1548f3882e14c0faec0aeb70b021b2b91b42e89b26dba`.
The sampler is not a maintenance safety gate: unreadable executable links
fall back to limited role classification; its inaccessible counter does not
count those fallbacks. Never reuse it to prove zero owned processes.

Source comparison finds per-pixel awaited WebDriver scroll calls with10ms
additional sleeps, unlike the standalone probe. This is a candidate for
controlled cost reduction, not a measured proof each call causes the drops.
The probe also mutes audio and disables backgroundThrottling. Electron45.1.0
documents that Linux page visibility follows hidden/minimized state, not
simply lack of focus; do not change throttling based only on focusable:false.
Sources consulted: Electron v45.1.0 docs/api/browser-window.md (Page visibility),
Context7 Electron web-preferences (default backgroundThrottling:true), and
https://docs.kernel.org/scheduler/sched-stats.html (/proc task counters in ns).
Next controlled test must hold media/geometry/audio/workload and visible
scroll choreography comparable, with fresh interruption approval if needed.
No application code changed or full unit suite reran in this read-only round.
Performance, exact decoder attribution and release gates remain open.
### 2026-11-04T02:47:52Z UTC — standalone GPU comparison completed
Operator023913Z and evidence023915Z in staging023354Z passed both preflights,
stop gates, software/default-gpu rounds (exit0), recovery and AB_RUN_COMPLETE.
All23 small evidence files were retrieved and independently SHA-verified at
main-checkout release-builds/r10-gpu-ab-20261104T023354Z/retrieved-evidence/.
Frame deltas, drop ratios,30-second wall intervals and CPU results were
independently recomputed in adjacent verified-comparison.json:
software80/692 dropped (11.5607%),20.5324 rVFC submitted frames/wall-s,
CPU93.0926%,27.5442 media seconds per30.0014 wall seconds;
default GPU12/739 (1.6238%),24.1665 submitted frames/wall-s,CPU80.5423%,
29.4488 media seconds per30.0002 wall seconds.
Drop rate fell85.954% relatively, CPU12.5504 percentage points. This is
one sequential, muted, standalone comparison, not exact display FPS or
full-artwork/representative-soak acceptance.

Both modes report VpxVideoDecoder/kIsPlatformVideoDecoder=false; enabled
video_decode capability is not proof this transparent VP9 uses hardware
decode. GPU mode enables compositing/rasterization/OpenGL. Initial alpha
samples match (0 fully transparent,3265 opaque,5951 partially transparent);
both final samples retain partial/opaque pixels but end at different media
positions. This verifies sampled source alpha, not visual window presentation.
Ask the operator about checkerboard visibility, black backgrounds/flicker
and click-through before a production candidate.

Recovery receipt has unchanged config/setup/main hashes, active lease and
fresh0→5→10s,frames176→433. Independent02:42:54–02:43:02 UTC observation
has105.034162→115.256409s,frames2805→3051,dropped709→737 and original
main SHA. A further independent hash check still matches all baseline files.
No installed GPU/browser-dialog change occurred; existing RC behavior remains.
The supplied terminal attachment ends with zsh parse error/exit1, but this
error is absent from the real host's run.log, which ends with AB_RUN_COMPLETE.
Do not conflate that separate shell error with a failed A/B, or claim its
exact cause without evidence. No probe was rerun or player restarted here.
### 2026-11-04T02:35:13Z UTC — debugger navigation deadlock located and corrected
Operator021802Z run passed preflight and stop gates. Evidence022346Z has
app-ready110ms, background-ready403ms, Media.enable421ms, then watchdog
55055ms waitingFor media-enable. No overlay-load, video metadata or GPU
round occurred. Full stderr remains `PROBE_FAILURE watchdog expired` and
`Error: target closed while handling command`; complete runner stack trace
and16 SHA-verified files are retained under main-checkout
release-builds/r10-gpu-ab-20261104T021802Z/retrieved-evidence/.

Electron45.1.0 official debugger.md explicitly documents that pre-navigation
sendCommand promises may not resolve until navigation (upstream issue14810).
The probe awaited that reply before calling loadFile: an initialization
deadlock in the diagnostic, not evidence of a media seek or GPU failure.
Corrected source loads the local page before debugger attach/Media.enable;
video src is still unset until runProbe, after Media.enable succeeds.
Three faithful-regression cases first failed, then passed; full119 tests
pass,0fail/0skipped, complete output in evidence/r10-gpu-navigation-*.log.

Recovery receipt verifies original config/setup/main hashes and0→5→10s,
frames176→432 with active lease. Independent02:32:45–02:32:53 UTC sample
shows280.186761→285.011912s, frames7180→7285 and dropped2814→2872, original
main SHA. Thus playback has later progress but remains heavily dropping;
this is not continuous health, visual or performance acceptance.
New staging r10-gpu-ab-20261104T023354Z has five matching SHA values and
both-host JS/Bash/Python syntax checks. No corrected live preflight/probe or
new interruption has run. Get fresh approval before another attempt, use
only the new entrypoint and preserve existing55/70s limits. No installed
code/profile/GPU flags, media or project Git history changed.
### 2026-11-04T02:19:28Z UTC — diagnostic revision staged; operator step pending
The user renewed approval for this short interruption. Five files in new
`~/.cache/transplayer-builds/r10-gpu-ab-20261104T021802Z/` independently
match local SHA-256 values. Local/remote JavaScript and Bash syntax, remote
Python AST and full116pass/0fail/0skipped tests passed. Private receipts and
complete test output are under main-checkout release-builds/ with that name.
SSH `sudo -n -v` reported no cached authorization. No new preflight, stop,
maintenance or live probe ran; there is no new A/B or recovery result.
Run as the normal exhibition user in the Ubuntu desktop terminal:
`bash "$HOME/.cache/transplayer-builds/r10-gpu-ab-20261104T021802Z/operator.sh" --run`.
Do not wrap the whole entrypoint in sudo or reuse014356Z. Authenticate only
at the actual terminal prompt. Keep all output on failure and do not retry.
### 2026-11-04T02:08:25Z UTC — software watchdog; GPU comparison incomplete
The operator ran staging014356Z. Both preflights and the maintenance gate
passed. Shutdown receipt saw28 descendants at0.768s and zero at1.534s;
port8080 was idle and the desktop restored. Software probe exit1 after its
55-second watchdog; no result.json, empty stdout, complete stderr:
`PROBE_FAILURE watchdog expired`
`Error: target closed while handling command`
The default-GPU round never ran. The separate terminal zsh parse error is
not established as the probe failure's cause.

All15 retrieved evidence files were SHA-verified under main-checkout
`release-builds/r10-gpu-ab-20261104T014356Z/retrieved-evidence/`.
Recovery receipt verifies unchanged config/setup/main hashes and fresh
0→5→10s playback, frames176→426, active lease. Independent6s and12s
observations later saw no next playback report. Those reports occur only
when media time crosses a5-second bucket, not as a wall-clock heartbeat.
At02:01:58–02:02:18 UTC, a read-only20-second sample subsequently showed
390.019646→405.080753s, frames9909→10284, dropped4082→4260:47.47% interval
loss between the two latest records. This confirms later progress, not
continuous healthy playback or exact screen FPS. Load remained about6.7–7.2
on two logical CPUs. Do not infer successful performance or a permanent freeze.

Local-only phase diagnostics pass six new VM cases and the full116-test
suite; full red/green output is retained in worktree evidence/. No installed
code/profile/GPU flag was changed, and the diagnostic revision has not been
uploaded or rerun. Root cause remains unknown; next live attempt requires
new staging/preflight and renewed interruption approval. Browser source
fixes remain undeployed; no project commit/push/tag/Release occurred.
### 2026-11-04T01:19:35Z UTC — revised preflight blocked; dialog source tested only
New private staging `r10-gpu-ab-20261104T010043Z` matched all four probe SHAs.
`--check` refused a PermissionError reading `/proc/1636/exe`; a separate
read-only inspection identified the process as owned user systemd/parent1.
No stop, maintenance action or A/B window ran. Full stack trace and logs
are retained under local `release-builds/r10-gpu-ab-20261104T010043Z/`.
Do not reuse the original permissive scanner or blindly retry this runner.
Continued-playback check returned exit0: frames56909→57055, currentTime
710.151698→715.057587, one8080 listener, active lease and original main SHA.
This is not a performance pass; dropped counts also increased20854→20919.
Dialog changes exist only in the isolated worktree; full portable suite
passed110/110,0fail/0skipped. No browser UI, GPU, new package or release
acceptance is implied. No installed code, existing profiles or media changed.
### 2026-11-04T00:14:39Z UTC — GPU comparison aborted, original playback restored
Local JavaScript/Python syntax checks and real-host preflight passed; four
staged probe files matched their SHA-256. Normal Stop returned exit0/stopped.
The immediate post-stop gate found AppDir processes and aborted before
prepare-maintenance or either A/B probe. The automatic recovery gate also
refused at that moment. Full failure and stack traces are retained.
Do not describe this as a completed GPU comparison or verified cleanup bug:
the actual exit delay and process identities at the failed gate were not
captured, and later inspection found zero remaining AppDir processes,
idle8080, inactive lease, visible panel and normal Dock state.

After this independent safe-state check, the untouched installed RC was
started through its normal entrypoint. Fresh logs showed775→0→5→10 seconds,
frames51→176→306→426, one8080 listener and active desktop lease.
Config/setup/main SHA-256 remained unchanged. No probe process was started,
no installed code/profile/media was changed, and no reboot occurred.
Private evidence was retrieved and all18 files SHA-verified; local receipt
root is `release-builds/r10-gpu-ab-20261104T000907Z/`.
Portable suite passed100 tests,0 failures,0 skipped; complete stdout/stderr
are retained there. This does not pass the A/B, transparency, full timeline,
soak or release gates. The probe needs a bounded, verified shutdown-settling
phase before a separately approved retry.
### 2026-11-03T16:08:26Z UTC — installation only
The operator completed the reviewed first-install recipe. Independent SSH
inspection confirmed `install ok installed`/`1.1.0~rc1`, actual apt0 upgrades/
63 additions/0 removals, clean dpkg audit, no maintenance marker and no user
configuration or autostart. The recipe recorded two loaded AppArmor profiles
and no package-owned processes. A second comparison against the deb payload
matched3,226 installed files, including content, modes and root ownership.
The2,396,160-byte private system-state/policy backup passed SHA-256 checking.
Complete apt output and receipts are retained as private evidence; this does
not establish lintian, lifecycle, full rollback or hardware acceptance.

The current GNOME login did not yet recognize the newly installed extension;
both displays remained landscape (scale1/transform0). The operator must save
work and log out/in before registration is checked again. No automatic
logout, rotation, reboot, configuration or playback was performed.

All other steps remain pending until executed with full output and actual observations.
Archive failures, cancellations and rollback evidence as well as successes.
Release remains RC / awaiting Ubuntu 26.04 hardware verification.

## Handoff Log
### 2026-11-04T04:40:39Z UTC — Warp
- State: GPU rc2 is installed; operator confirmed normal audio and no warning,
  translation or Download Chrome bars. Full-workload performance remains
  blocked: earlier90s sample38.00% drops, later30s sample47.64%; different
  workloads, not controlled regression. The latter measured98.55% system
  CPU and14–15s runqueue waits for the busiest video threads.
- State: Read-only host check at04:35:50 UTC confirmed rc2/config/setup
  present, but `~/.config/autostart/transplayer-r10.desktop` and
  `~/.config/monitors.xml` absent. Do not expect automatic playback after
  reboot or assume portrait rotation is persistent. This handoff did not
  reboot, enable autostart, save displays or re-sample playback.
- State: Main checkout remains clean atab8bf5d. Uncommitted implementation
  and this runbook remain in sibling worktree `transplayer-r10-linux-build`,
  branch `fix/r10-linux-optional-dependencies`. Preserve modified and
  untracked files, private evidence, verified rc1 rollback package and
  stopped-profile/system backups. Last full candidate tests were126 Node
  and52 installer Python on Linux; no full suite reran for this handoff.
- Decisions: Official Electron45.1.0 DEPS pins Chromium156.0.8078.49.
  That Chromium version's
  `MojoGpuVideoAcceleratorFactories::IsDecoderConfigSupported` rejects
  kHasAlpha unless the codec is HEVC; VP9 alpha is therefore rejected by
  this hardware-decoder selection path. VpxVideoDecoder separately decodes
  color and alpha using libvpx. This is a source-backed limitation matching
  the standalone observation, not a new production decoder trace.
  NVIDIA documents normal VP9 decode for AD10x, but that does not establish
  Linux/Electron hardware decoding or alpha preservation on this host.
- Decisions: Color plus grayscale-mask packing and GPU shader reconstruction
  was proposed only, not approved or implemented. Likewise, lowering
  per-pixel WebDriver overhead remains an untested optimization proposal.
  Do not transcode the original, blindly add flags, lose alpha, change the
  artwork's scroll choreography or modify remote-access settings.
- Next steps: Ask which work the user wants next. For reboot readiness,
  obtain go-ahead, verify physical rotation/side mapping, back up current
  display/config state, persist and confirm GNOME display settings, enable
  the owned login autostart entry, and separately coordinate reboot with
  remote-access recovery. For hardware decode, first isolate an ordinary
  opaque-video proof, then evaluate alpha reconstruction without replacing
  the live installation. Any playback interruption needs fresh approval.
- Next steps: Retain performance/lifecycle/boot/rollback/soak, lintian,
  licensing, vulnerability and sandbox gates. No project commit/push/tag/
  Release until the original conditional release requirements pass.
- Open questions: Which next path is authorized? Ordinary video hardware
  decode in this Linux stack, exact production decode/composition costs,
  saved display geometry and reboot/autoplay are not yet verified.

References checked during the preceding hardware-decoding consultation:
- https://raw.githubusercontent.com/electron/electron/v45.1.0/DEPS
- https://chromium.googlesource.com/chromium/src/+/refs/tags/156.0.8078.49/media/mojo/clients/mojo_gpu_video_accelerator_factories.cc
- https://chromium.googlesource.com/chromium/src/+/refs/tags/156.0.8078.49/media/filters/vpx_video_decoder.cc
- https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/nvdec-video-decoder-api-prog-guide/index.html
