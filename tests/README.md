# Verification

Run `npm test` (or `node --test tests/*.test.js`) with Node 18 or newer and
Python 3.10+ on the development machine. The test runner is built in; no test
package is installed, and the Python tests use only its standard library.
The r10 target is Ubuntu26.04 amd64 / GNOME50. Its application retains
Electron45.1.0 / embedded Node24.22.1; the separate supervisor uses
Node24.22.2 / PM2 7.1.1. Existing pure modules retain Node12-compatible
syntax for the historical installation.

## r10 installer / Ubuntu 26.04 candidate

`installer.test.js` invokes `installer_cases.py` with Python's standard
`unittest`. Run it directly with `python3 tests/installer_cases.py`.
It covers private/idempotent settings, explicit replacement/backup,
foreign/legacy state, symlink and command-injection inputs, write rollback,
real cross-process account-lock blocking, safe diagnostic export, malformed
PM2 state, bounded login readiness, GDK initialization/probe isolation,
individual monitor geometry, input manifests (including nested manifests),
safe Node archive extraction, synthetic staging, and mocked maintenance
configure failure/retry plus process-scan refusal.
Fixtures use standard-library temporary directories inside the Python suite;
no real media, personal browser data or credentials.
GTK widgets, real PM2/exec FD inheritance, AppArmor, apt/dpkg and physical
desktop behavior are **not** exercised by these portable tests.
The one Node wrapper test is not 39 separate Node tests.

Acceptance criteria: [Ubuntu26 installation protocol](manual/ubuntu26-installation.md),
which remains **NOT EXECUTED**. The user deferred new-hardware testing;
Ubuntu25 results below cannot satisfy it.
New logic needs happy/edge/error cases and hostile trust-boundary inputs.
Ignored `evidence/` retains `tools-green.log` (23 tests),
`hardening-red.log` / `hardening-green.log` (32 tests after fixes),
and `desktop-boundary-red.log` / `desktop-boundary-green.log`
(36 tests after fixes). Failed logs are preserved, never rewritten.
`maintenance-reentry-red.log` / `maintenance-reentry-green.log` add
mocked install/upgrade/configure ordering, wrong-platform refusal,
idempotent AppArmor removal and accurate r10 metadata (39 tests after fixes).
The historical Node baseline is 97; r10 adds one Python-suite wrapper.
The final phase-one run passed **98 Node tests, 0 failures, 0 skipped**;
the separately executed Python suite passed **39 tests (OK)**.
Full output: `evidence/r10-final-full-tests.log` and
`evidence/maintenance-reentry-green.log`.
Static checks passed 41 local documentation links, 17 shell examples,
Python/JSON/JavaScript/shell syntax and complete historical README preservation
(`evidence/r10-final-static-checks.log`).
Gitleaks scanned all 77 tracked/untracked nonignored source candidates with
no leaks found (`evidence/r10-gitleaks.log`).
These results do not create or validate a real Linux package.

### Direction confirmation and crash-restore suppression

Latest portable run: **100 Node tests, 0 failures, 0 skipped**, including
one wrapper running **48 Python tests (OK)**. Complete output:
`evidence/r10-display-restore-full-tests.log` and
`evidence/r10-display-lifecycle-green.log`.
`chrome-session.test.js` adds initial/replacement launch checks for
`--hide-crash-restore-bubble` without restoring old tabs.
It also checks `--disable-infobars` on both launches without adding
certificate, web-security or full/GPU-sandbox bypass switches. Chromium156
supports this switch in Chrome for Testing for buttonless information bars;
it does not dismiss interactive confirmations. Red output is retained in
`evidence/r10-infobars-red.log`. Real browser UI acceptance remains required.
`installer_cases.py` adds direction-only pattern planning from logical
geometry, independent rotation metadata, reversed enumeration/negative
origins, malformed/mirrored/gapped/offset layout rejection, fixed settings
launcher, active-controller/lease refusal, both-lock lifetimes, CLI/root
gates, and mocked GTK Escape/button/destroy/timeout/layout/fullscreen-failure
and partial-construction cleanup. The package fixture checks the new helper
and display-settings dependency.
All GTK objects here are mocked; this is **not** a real window-placement,
rotation, power-loss or browser-bubble acceptance test.
Seam alignment is not required by the user.
Red output is retained in `evidence/r10-restore-bubble-red.log`,
`evidence/r10-display-setup-red.log` and
`evidence/r10-display-lifecycle-red.log`. Four actual rotation combinations,
direction/side appearance, restart persistence and browser-level crash UI
remain **NOT EXECUTED** under the Ubuntu26 manual protocol.

See [development](../docs/development.md) and [operations](../docs/operations.md)
for build provenance, release blockers and maintenance boundaries.
### Linux supervisor input preparation

`installer_cases.py` reproduces Linux npm's omission of darwin-only optional
`fsevents`. Synthetic fixtures exercise positive/negative OS and CPU constraints
for the fixed Linux/x64 output target. Missing required or applicable optional
packages, malformed metadata, present version mismatches and symlink inputs
remain rejected. Four new Python tests are subtests within the existing Node
wrapper, not four additional Node tests. These fixtures do not execute PM2.

## Dedicated browser dialog preferences

`chrome-session.test.js` exercises real private temporary profiles as well
as injected browser/driver boundaries. It checks translation/password-save/
auto-sign-in/passkey-upgrade/autofill offers off, default notification/location/
camera/microphone settings blocked, unrelated settings and site exceptions
preserved, byte-idempotent reopening, corrupt/nonobject/nested JSON refusal,
directory/file symlinks, hardlinks, unsafe permissions and live-lock refusal.
Initial and replacement starts must prepare on-disk preferences before spawn.
The actual attachment capability builder is checked for prompt `dismiss`,
not `accept`; this takes effect when WebDriver encounters the prompt, not
as a universal website-dialog blocker.

The current portable run passed **110 Node tests, 0 failures, 0 skipped**;
the Chrome suite passed **29 tests**, and the shutdown wrapper runs seven
Python cases. Full output: `evidence/r10-dialog-preferences-full-final.log`
and `evidence/r10-dialog-preferences-green-final.log`. Red output, including
the initial fixture setup failure and corrected behavioral red, is retained
in `evidence/r10-dialog-preferences-red.log` and `-red-v2.log`.
These tests do not launch real Chrome or prove browser UI acceptance.

## GPU diagnostic shutdown settling

`gpu-probe.test.js` runs `gpu_probe_cases.py` with stubbed installer imports;
no player, Linux desktop, browser, network or signal is used. Seven Python
settling cases cover immediate idle, delayed process exit with retained identities,
listener/lease/panel release, persistent activity, inspection errors,
invalid limits and late observations. The real inspector bounds its desktop
subprocess by the remaining deadline. These tests do not establish real GPU
performance. Complete red/green output is retained under ignored `evidence/`
as `r10-gpu-settle-*.log`.
Eight additional inspection cases (15 Python tests total) exercise explicit
CLI opt-in, fixed numeric-PID sudo/readlink argv with no shell or password
input, no elevation for readable processes, failed/expired authorization,
timeouts, invalid budgets, hostile PID/output and changed process identity.
All sudo/process calls are mocked; no real privileged command is run.
Red/green/full output is retained in `evidence/r10-gpu-inspection-*.log`;
full portable suite remains110 Node tests,0fail/0skipped (one wrapper).
`experiments/gpu-playback/operator.sh` is syntax-checked separately; its actual
sudo credential cache, GNOME effects and restoration require the live protocol.

### GPU probe phase diagnostics

Six additional VM cases in `gpu-probe.test.js` execute the actual diagnostic
main/renderer scripts with synthetic Electron/video boundaries. They cover
metadata and seek stalls, play rejection, successful measurement ordering,
the unchanged55-second watchdog retaining its last phase, and allowlisted
console relay rejecting arbitrary stage text/URL fields. No real media,
Electron window or GPU is used. `progress.jsonl` is created exclusively0600;
phase logging does not change seek/play order or extend timeouts.
Electron's Event-property `console-message` API is supported since35, including
the pinned45; reference: official `docs/api/web-contents.md` and
`docs/breaking-changes.md`, consulted through Context7 on2026-11-04 UTC.

Behavioral red output (six failures), focused green (7pass/0fail/0skipped)
and full suite (116pass/0fail/0skipped) are preserved in
`evidence/r10-gpu-progress-{red,green,full}.log`.
The15 Python cases remain one Node wrapper, not15 extra Node tests.
At the021802Z staging handoff, phase diagnostics were SHA/syntax-verified
but not yet live-run; the subsequent live failure and correction are below.
The full116-test output from that handoff is
retained in main-checkout `release-builds/r10-gpu-ab-20261104T021802Z/full-tests.log`.
See the latest manual evidence before any retry.

### GPU debugger navigation dependency

The021802Z live phase trace stopped at Media.enable before page navigation.
The fixture now models a debugger reply that stays pending until navigation,
instead of resolving every mocked command immediately. Three new cases cover
navigation→attach→Media.enable→renderer ordering, navigation failure with no
debugger commands, and Media.enable failure with no renderer invocation.
The probe now loads its local page first; the video still has no src until
runProbe, so media instrumentation is enabled before playback starts.
Fixed-version official reference:
https://raw.githubusercontent.com/electron/electron/v45.1.0/docs/api/debugger.md
and upstream https://github.com/electron/electron/issues/14810 ,
consulted through Exa on2026-11-04 UTC.

Complete red (3 failures), focused green (10pass/0fail/0skipped) and full
(119pass/0fail/0skipped) outputs:
`evidence/r10-gpu-navigation-{red,green,full}.log`.
The subsequent023354Z live comparison completed both rounds and restoration;
see the manual evidence for measurements and limitations. Unit tests and
the earlier failed probes do not establish GPU performance.

## Production GPU startup

`main.test.js` executes the actual production entrypoint in a VM with
synthetic Electron, process and child boundaries, plus real canvas geometry.
Seven cases cover default GPU policy without bypass flags, transparent
click-through placement and renderer isolation, hostile navigation/foreign
status rejection, wrong-display refusal before forking, cooperative/idempotent
stop, stop-only startup and duplicate-instance refusal.
The GPU-policy case failed before removing the global acceleration disable;
the six invariant cases already passed and remain regression guards.
These are not real Electron/GNOME, audio or performance tests.
Complete red/green/full output:
`evidence/r10-main-gpu-{red,green,full}.log`.
The full run passed126 tests,0fail/0skipped.

## Historical r9 and earlier verification

`portable.test.js` covers the agreed 2160×1920 display union, negative
coordinates, external UTF-8 media configuration, invalid input, and hostile
OSC values. Fixtures are synthetic temporary files removed by each test.

`controller.test.js` verifies awaited WebDriver session cleanup and that
every controller operation referenced by the live timeline remains available.
`timeline.test.js` executes the real timeline with a recording controller:
all 13 search terms, image/date URL parameters, 19 event times, rectangles,
scroll distances, repeat-loop behavior, idle seconds and shutdown are checked.
`browser-toolchain.test.js` invokes Python 3 to test exact archive hashes,
missing inputs, browser version mismatches and hostile ZIP paths/symlinks.
`controller.test.js` also checks Manifest V3 solver loading, separate r7
profiles, and the operator's extension opt-out.
The timeline/controller VM fixtures are defined inside their suites and
never open a real browser. Browser archive fixtures are synthetic temporary
ZIP files; test subprocess execution is mocked for those files.
`desktop.test.js` uses synthetic GNOME actors to test top-bar hiding,
native Dock visibility, player-PID exclusion, snapshot ownership,
partial-failure rollback and restoration.
`desktop-modern.test.js` adds GNOME49 lease acquisition, hostile PID/UID/
ancestry/executable/script inputs, duplicate/foreign ownership, caller
disconnect, extension-disable and partial-failure restoration. It imports
the same lease module shipped in the extension, not a reimplementation.
It also reproduces Electron45's observed single-title Linux command line,
accepts only the exact expected title, and rejects lookalike paths, altered
flags and nonempty hidden arguments. Red and full-green logs are retained
as evidence/ubuntu25-title-red.log and evidence/ubuntu25-title-green.log.
`install-desktop.test.js` runs the actual Python installer with a synthetic
HOME, video and gio/xdg-user-dir stubs; it checks AppDir launchers, path
quoting, config permissions, overwrite refusal and invalid entrypoints.
`chrome-session.test.js` checks normal Chrome-first launch, concurrent
start/close, exact loopback debugger URL, actual /proc socket-inode ownership,
foreign listeners, exited child identity, startup/attach failures, stop during
startup and cleanup despite quit/Browser.close errors. Dependencies are
injected; no real Chrome or network is opened by this unit suite.
It now tests a claimed private profile with a same-host dead-PID lock:
preflight leaves the symlink untouched for Chromium's own recovery while
rejecting a live, foreign, malformed or regular-file lock.
Controller tests also verify chrome-first avoids solver reads, preserves
legacy behavior and reports failed creation/cleanup. GNOME49 tests admit
only matching r8/r9 guard/executable/app combinations, rejecting mixed
versions and root-path lookalikes.
`controller.test.js` now checks that an exited owned Chrome cannot keep its
cached WebDriver, and that failed cleanup prevents a concurrent replacement.
The two new TDD red logs and passing focused run are
`evidence/r9-profile-lock-red-20261031.log`,
`evidence/r9-browser-reconnect-red-20261031.log` and
`evidence/r9-browser-reconnect-green-20261031.log`. The full current suite:
97 pass, 0 fail, 0 skipped (`evidence/r9-browser-recovery-full-20261031.log`).
The complete Linux stage3 suite also passed 97/0/0
(`evidence/r9-stage3-linux-tests-20261031.log`). Stage3 is now installed;
old stage2 is retained. The first maintenance observer failed reading
protected `/proc/1764/exe` after stopping PM2; preserve
`evidence/r9-stage3-maintenance-20261030T233132Z.log`.
The corrected privileged process gate and atomic deployment passed in
`evidence/r9-stage3-maintenance-v2-20261030T233554Z.log`.
The real-browser rehearsal killed only verified se_13 Chrome once via
pidfd, observed its stale lock and recovery without manual deletion.
Images/scrolled content appeared at 118.2 seconds; continued scrolling,
accepted geometry, released old debugger and unchanged player PID/PM2
restart count passed at 129.1 seconds. The user confirmed the recovered
fullscreen search/video overlay. Full observations are retained in
`evidence/r9-stage3-real-browser-recovery.log`; runner exit 0.
This is event-driven, not immediate recovery; the original exit cause
remains unresolved. On 2026-10-31 (UTC), the user confirmed more than
eight hours of operation with normal playback at inspection, and correct
automatic playback after reboot. These are user-reported manual results,
not a continuously instrumented soak or a corrected post-login diagnostic
pass. Complete resource/error/restart records remain unavailable.
The release remains r9 stage3 RC / field trial, not a fully accepted
production release. See the current acceptance section in
`manual/ubuntu25-r8.md`. Historical worktree `evidence/` files referenced
here are preserved under `evidence/r9-handoff-20261030/` in the main
checkout and are not committed.
A preceding user-approved reversible
lock move aborted at its activity gate without changing the host:
`evidence/r9-stale-lock-reversible-recovery-20261031.log`.
Stage1 local/Linux suite:73pass/0fail/0skipped, evidence/r9-full-green.log.
Stage2 local suite:76pass/0fail/0skipped, evidence/r9-stage2-full-green.log.
Added profile-ownership safeguard then passed local/Linux77tests;
evidence/r9-basic-profile-red.log and r9-stage2-full-green-v2.log.
New regressions cover basic-store launch and Dock availability/replacement
after extension enable; acquisition fetches current Dock instances and
fails closed if they are absent. Red evidence: r9-stage2-red.log.
Synthetic quit/close errors in that output are intentional error-path tests.
`pm2.test.js` checks the r9 fixed root entrypoint and PM2 single-instance/
shutdown policy, using synthetic X11, GNOME49 restricted Status, D-Bus and
sleep commands for bounded readiness, check-only mode, missing desktop
authentication, stale extension revisions and paths containing spaces.
`pm2-session.test.js` exercises the current-login wrapper with isolated
PM2 stubs: fresh credentials, no duplicate online start, replacing only
one stopped definition, refusal of foreign/errored state or missing
Xauthority, scoped stop and unsupported actions. It opens no real player.
The session-gate correction passed 8/8 and the complete local suite
passed 92/92. The subsequent PM2 7.1.1 SIGKILL rehearsal exposed that
`stop_exit_codes: [0,78]` prevented restart even on an abnormal signal
exit logged as code 0. The recovery-policy regression was red (13 pass,
7 fail, including six expected version-path failures), then its two
focused suites passed 20/20 and the full suite passed 92/92 (0 fail,
0 skipped). Complete output is retained under ignored
`evidence/r9-pm2-crash-recovery-red.log`,
`evidence/r9-pm2-recovery-green.log` and
`evidence/r9-post-pm2-recovery-full.log`. The failed live result is
`evidence/r9-pm2-abnormal-recovery-20261030.log`; unit tests are not
evidence of automatic recovery or next-login autostart.

Historical Linux integration probes run with the matching bundled Electron:
`browser-smoke.js` (synthetic real Chrome page), `bridge-smoke.js`
(readiness and port release), `desktop-smoke.js` (real GNOME parent-disconnect
recovery), and `media-smoke.js` (muted hidden real-video decode).
`desktop-smoke.js` and `dock-smoke.js` still use the old, unsupported GNOME
`Eval` API and **must not** be run as GNOME49 acceptance checks without
adapting them to the restricted desktop lease. Their commands below apply
only to an environment supporting that historical API.
`dock-smoke.js` creates its own transparent overlay and synthetic Chrome
window, verifies shown/hidden/shown Dock behavior, and cleans up both.
Run it as Electron without `ELECTRON_RUN_AS_NODE`, with playback stopped
and no unrelated windows overlapping the Dock.
Set `TRANSPLAYER_APP_ROOT` to the bundle's `app` directory; browser probes
also need `TRANSPLAYER_CHROME` and `TRANSPLAYER_DRIVER`. The media probe needs
`TRANSPLAYER_VIDEO` and is run as Electron, without `ELECTRON_RUN_AS_NODE`.

Historical r7b example only, on the matching Linux desktop and
source snapshot (not the Mac development machine or GNOME49 acceptance):

```sh
BUNDLE="$HOME/Documents/transplayer-releases/portable-r7b.AppDir"
SOURCE="$HOME/Documents/transplayer-source-r7b"
export TRANSPLAYER_APP_ROOT="$BUNDLE/app"
export TRANSPLAYER_CHROME="$BUNDLE/browser/chrome"
export TRANSPLAYER_DRIVER="$BUNDLE/app/bin/chrome/chromedriver"
export DISPLAY=:0
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export XAUTHORITY="$XDG_RUNTIME_DIR/gdm/Xauthority"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
ELECTRON_RUN_AS_NODE=1 "$BUNDLE/runtime/electron" "$SOURCE/tests/browser-smoke.js"
```

Use the actual session's authority file if it differs. `browser-smoke.js`
creates/cleans its own profile and uses a synthetic local page, not a live
search or proof that CAPTCHA is resolved.

With the installation stopped and the Dock area free of unrelated windows:

```sh
env -u ELECTRON_RUN_AS_NODE "$BUNDLE/runtime/electron" "$SOURCE/tests/dock-smoke.js"
ELECTRON_RUN_AS_NODE=1 "$BUNDLE/runtime/electron" "$SOURCE/tests/desktop-smoke.js"
```

These desktop probes mutate temporary GNOME state and must not run over an
active player. Do not close unrelated windows merely to make a test pass.
Media and bridge probes have their own preconditions in the script and
manual protocol; do not start a second controller on an occupied 8080 port.

Historical root-level browser experiment scripts are not part of this
repository or the automated suite.

See `manual/portable.md` for the required real-desktop protocol. Automated
tests cannot establish video transparency, physical monitor orientation,
website availability, or exhibition readiness.
The current Ubuntu25 deployment protocol is in `manual/ubuntu25-r8.md`.
The older Google/new-browser protocol is in `manual/google-r7.md`.
The earlier DuckDuckGo procedure is retained in `manual/duckduckgo-r6.md`.
