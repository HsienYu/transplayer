# Verification

Run `npm test` (or `node --test tests/*.test.js`) with Node 18 or newer and
Python 3 on the development machine. The test runner is built in; no test
package is installed, and the Python tests use only its standard library.
The new Ubuntu25 target bundles Electron45.1.0 / Node24.22.1; existing pure
modules retain Node12-compatible syntax for the historical installation.

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
