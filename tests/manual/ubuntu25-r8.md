# Ubuntu 25.10 replacement-host deployment

Approved scope: Ubuntu 25.10 x86_64, GNOME 49, Wayland, Ubuntu Dock 102.
Preserve RustDesk, both desktop video files, and the old exhibition host.
Do not restart the desktop, log out, reboot, disable sandboxing, or change
system security policy without a separately coordinated decision.
## Current r9 operation and promotion gate (2026-10-30)

The fixed, root-owned `/opt/transplayer/releases/r9.AppDir/AppRun` is the
current installation. Both desktop entries now invoke the versioned r9
PM2 session script. The XDG autostart entry passed a real user-performed
login: the user reported playback without a keyring prompt. A read-only
check passed one unbounded r9 PM2 player, revision-2 lease, portrait
displays, RustDesk and one loopback 8080 listener. Its obsolete
`NO_PM2_DUMP` assertion then failed before checking desktop targets;
preserve the failure at `evidence/r9-post-login-autostart-20261030.log`.
PM2 7.1.1 automatically writes a stopped process dump on daemon SIGTERM
at logout. This dump contains an old bounded test definition and former
graphical-authority field. It has **not** been resurrected; there is no
PM2 resurrect service, and the login script never calls `pm2 resurrect`.
The `.local`, `share` and `transplayer` parents are private 0700. Do not
call `pm2 resurrect` or `pm2 update` to handle this incident. Node
24.22.2 and PM2 7.1.1 are pinned in private user directories.
The older r8 deployment record below is rollback evidence, not the current
r9 startup procedure.

### Live incident: fullscreen search browser disappears

After the real login the user reported the initial fullscreen search browser
sometimes disappears during playback/search transitions. Read-only inspection
found zero r9 Chrome processes while the PM2 player remained online;
`transplayer-error.log` recorded 55 `Chrome profile already locked` failures,
last at 2026-10-31 06:50:34 Asia/Taipei. Only dedicated `se_13` has a
`SingletonLock`: an owner-owned symlink for this hostname and a dead PID,
created at 2026-10-31 05:59:45 Asia/Taipei. All six other search profiles
were unlocked. Earlier `invalid session id` was also logged; its underlying
Chrome exit cause is not established. Installed r9 rejects every lock before
launching Chrome and keeps a cached WebDriver after its Chrome child exits.
This is a real playback failure, not a passed soak test.

The source-only fix permits only a same-host, valid dead-PID lock to reach
Chrome's own singleton recovery; it never deletes the lock. A live,
other-host, malformed or unowned lock remains refused. It also discards a
driver whose owned Chrome child exited, without starting a replacement
during failed cleanup. It is **not yet installed** in the root release.
TDD failures and passing focused tests are retained in
`evidence/r9-profile-lock-red-20261031.log`,
`evidence/r9-browser-reconnect-red-20261031.log` and their `-green` logs.
Chromium's singleton behavior is documented in its source:
https://chromium.googlesource.com/chromium/src/+/HEAD/chrome/browser/process_singleton_posix.cc.

Temporary recovery on the running host requires the user's separate
go-ahead **for this run and time window**. No player restart, remote logout
or broad process signal is authorized. Rollback restores the original lock
symlink from a new private backup only while no browser owns the profile.

1. Recheck exactly one online r9 PM2 app and one loopback 8080 listener;
   do not interrupt it. Require RustDesk active, one active revision-2
   desktop lease, zero r9 Chrome/Driver processes using `se_13`, and zero
   `se_13` debugger listeners. Abort if activity is ambiguous.
2. Require a private `profiles-r9-basic/se_13` with its exact exhibition
   marker. Require exactly one owner-owned `SingletonLock` symlink, with
   target current hostname, hyphen and positive decimal PID. Require
   that PID absent from `/proc` on this host. Do not read cookies or print
   the target, arbitrary command lines or PM2 environment. Abort on any
   mismatch or if the lock changes between gate and action.
3. As the exhibition user, create one new versioned backup directory
   (0700). Recheck the original lock inode and target, then atomically
   `os.rename` **only** `se_13/SingletonLock` to
   `~/.local/share/transplayer/backups/r9-browser-lock-<timestamp>/SingletonLock.se_13`;
   never unlink or overwrite it. Verify one backup symlink, zero old locks,
   and unchanged online r9 player/port. Keep the backup for rollback.
4. At the next natural fullscreen-search event, require exactly one owned
   `se_13` Chrome browser, one local debugger, loaded/scrolled real images,
   and one player/8080 listener; record sanitized counts and the user's
   visual result. If it fails, preserve evidence and do not repeat
   blindly. Rollback first requires zero `se_13` Chrome/Driver/debugger
   and no replacement lock; atomically rename the backup to the original
   pathname, without overwriting anything. Preserve all failures.

The permanent fix needs a new immutable root release, full tests,
versioned backup, activity gate, coordinated maintenance window, atomic
deployment and real-browser recovery verification. Do not replace the
root AppDir while the player is active.

The first user-approved live attempt stopped at `ZERO_R9_CHROME_AND_DRIVER`:
another search profile (`se_15`) was legitimately running. The command
did **not** reach backup creation or lock movement; preserve its failure
as `evidence/r9-stale-lock-reversible-recovery-20261031.log`. Do not
reinterpret that approval as permission to stop the player or retry.

For a separate, user-approved **short playback-maintenance window**:

1. Obtain a new explicit go-ahead and on-site activity confirmation.
   Require one correct online r9 PM2 player, one loopback 8080 listener,
   revision-2 active lease and RustDesk active. Confirm original `se_13`
   lock still points to an absent same-host PID. No root-release change.
2. Use the already installed versioned `pm2-session.sh stop` (never
   `AppRun --stop`) with this session's environment. Require one stopped
   PM2 definition, zero owned r9 Chrome/Driver processes, zero port 8080
   listeners, inactive lease, visible panel and RustDesk active. Abort
   if cleanup is incomplete; do not remove any lock or force-kill a PID
   without its own coordinated recovery decision.
3. Only after step 2 passes, repeat the symlink/owner/marker/dead-PID
   checks from the temporary procedure. Atomically move just the
   `se_13/SingletonLock` to a unique private 0700 backup, preserving its
   inode and target, and require zero locks at the original path.
4. Using the current graphical login's readable Xauthority, start via
   the installed `pm2-session.sh start`. Require exactly one online r9
   app, one loopback 8080 listener and one revision-2 active lease. At
   the next naturally scheduled fullscreen search, require one `se_13`
   Chrome browser, one owned loopback debugger, loaded/scrolled images
   and the user's visual confirmation. Do not claim success from PM2
   `online` alone; keep all failures and measured waiting time.
5. If start or browser verification fails, stop only the PM2 player and
   require zero owned r9 Chrome/Driver/debugger/8080 before attempting
   rollback. Restore the backed-up symlink **only if** the original path
   remains absent; never overwrite a newly produced Chrome lock. Keep
   the root release, original lock backup and failure evidence intact;
   report the safe stopped state and coordinate the next action. If
   successful, retain the original symlink in private backup until
   permanent source recovery is deployed and tested.

The user separately approved this short maintenance run. The installed PM2
session script's `stop` action left one stopped definition, zero r9
Chrome/Driver/8080, an inactive revision-2 lease, restored panel and
active RustDesk. The original
same-host dead-PID `se_13` symlink was atomically moved, without unlink,
to private
`~/.local/share/transplayer/backups/r9-browser-lock-20261030T225845Z/`;
its inode and target were checked. Starting the **unchanged** root r9
through current-login PM2 produced one unbounded online player, one
localhost 8080 listener and an active revision-2 lease.

The first post-start browser observer failed after 35 seconds because it
assumed Chrome's rewritten single-string process title contained separate
argv entries. Preserve this observer failure, not as a browser failure:
`evidence/r9-browser-maintenance-chrome-live-20261031.log`.
A corrected **read-only** observer found one owned `se_13` Chrome browser
and debugger bound only to 127.0.0.1, an actual Google page with 224 images,
221 loaded, scrollY 1788 and scroll range 2289, and no challenge in this
sample. A fresh Chrome lock exists; the original remains in the private
backup. The user also saw the expected fullscreen search on site.
Evidence is `evidence/r9-browser-maintenance-stop-20261031.log`,
`evidence/r9-browser-maintenance-lock-backup-20261031.log`,
`evidence/r9-browser-maintenance-restart-20261031.log`, and
`evidence/r9-browser-maintenance-chrome-verified-20261031.log`.
Do not restore the backed-up lock over the new one. This demonstrates
temporary recovery only: the permanent source fix has **not** been
installed and the original Chrome exit mechanism is still unknown.
### Stage3 browser-recovery candidate and separate deployment gate

**Now deployed; initial staging record follows.** The candidate source archive in the user-owned staging
directory `~/Documents/transplayer-staging/r8-20261030T131505Z/` passed
SHA-256 `a6551594fcfe331e88d67557b93b9df184952fe3659adb40feb127bfd5c71eee`,
56 safe regular members and 328683 uncompressed bytes before extraction
to the new `source-r9-stage3`. Existing pinned Node 24.22.2, matching
package lock and dependencies produced a complete Linux result of
97 pass / 0 fail / 0 skipped. The newly built
`portable-r9-stage3.AppDir` passed independent verification of all 726
manifest entries; its `SHA256SUMS` SHA-256 is
`78611f07a38a1965cb3d819a028286452db5cedf4bc55975710d73d5b602fe1a`.
The root-install archive `release-r9-stage3.tar.gz` has SHA-256
`e716084439dd922cc180f37046a295ffd2e98a14c282d49ba62fb94cd110e187`;
all 818 members were compared to staging (727 files, 91 directories,
no links, unsafe paths or special permissions). See
`evidence/r9-stage3-linux-tests-20261031.log`,
`evidence/r9-stage3-build-20261031.log`,
`evidence/r9-stage3-independent-verification-20261031.log` and
`evidence/r9-stage3-archive-verified-20261031.log`. The old root r9
manifest is still `1e885bfac2ab75861a2a6c1df1915c46978c2abf7583f6c2d8f65f8aabc3d115`.

This is a **new** production change, not covered by the previous
short-stop approval. Obtain the user's explicit approval for this run,
its maintenance window and temporary loss of playback before stopping
anything. Confirm with the on-site user that no exhibition audience is
using the display; remote PM2 online/idle state alone is not an
activity signal. Use the present graphical session, not a cached
Xauthority path. No plaintext password in any shell command or log;
if root installation cannot obtain interactive authorization safely,
leave the existing player running and stop here.

1. Before stopping, verify the unchanged root r9 manifest SHA-256
   above with **726 matching entries**, root-owned fixed paths, existing
   r8 and r9-stage1 AppDirs, the private old-lock backup, RustDesk
   active, one correct unbounded online r9 PM2 app, one loopback 8080
   listener, revision-2 active lease and two 1080x1920 portrait
   monitors. Confirm the user's idle-display signal again immediately
   before the change. Abort on any mismatch; never assume an earlier
   check still applies.
2. Invoke only the installed
   `~/.local/share/transplayer/supervisor/r9-20261030-login-safe/packaging/pm2-session.sh stop`
   as the exhibition user. Require exactly one stopped PM2 definition,
   **zero** owned r9 Electron, Chrome and Driver processes, debugger
   listeners and 8080 listeners, inactive revision-2 lease, visible
   panel and active RustDesk. If cleanup fails, do not touch `/opt`;
   investigate without broad signals or profile deletion.
3. Recheck the fixed archive SHA, 818 safe members, 726 manifest
   entries, and free space. Only then extract as root to a **new**
   `/opt/transplayer/releases/r9-stage3-candidate.AppDir` through a
   strict regular-file/directory-only reader that rejects absolute,
   parent-traversing, duplicate or special-permission members. Never
   extract over `r9.AppDir`. Verify root owner, nonwritable-by-other
   permissions and all 726 hashes while it is still at the candidate
   path. Retain the verified old `r9.AppDir` as the rollback version.
   Do not alter AppArmor policy: its executable allowlist refers to
   the fixed `r9.AppDir` path, so no user-owned staging binary may be
   launched as the live release.
4. With the **zero-player/zero-port/inactive-lease and user-idle**
   gates repeated, atomically exchange the candidate directory with
   `r9.AppDir` using the previously exercised Linux `renameat2`
   `RENAME_EXCHANGE` mechanism. The candidate path now contains the
   prior stage2 release; verify its old manifest and rename that
   directory to a **new, nonexisting**
   `/opt/transplayer/releases/r9-stage2.AppDir`. If this archive
   rename fails, leave both paths intact and stop: never overwrite
   stage1/r8 or assume which directory contains which version.
   Independently verify the new root r9 has the exact stage3
   manifest and 726 hashes, and the archived stage2 has the old
   manifest and 726 hashes, before restarting.
5. Start only with the existing installed `pm2-session.sh start` in
   the current login. Require one **unbounded** online player, one
   localhost 8080 listener, one revision-2 active lease and advancing
   video. At natural fullscreen search events, require one owned
   `se_13` Chrome root and local debugger, actual loaded/scrolled
   images and the user's visible fullscreen confirmation. Separately,
   in this coordinated maintenance window and only after another
   owner/PID check, test unexpected browser exit and stale-lock
   recovery without deleting/overwriting either the current profile
   lock or its preserved backup. A synthetic lock in an isolated
   dedicated profile is not by itself proof of recovery for the
   exhibition profile. Record timings, counts, failures and post-exit
   cleanup; do not claim the original Chrome-exit cause is fixed.
6. If installation/start/recovery fails, stop only this PM2 player and
   require zero owned processes/debugger/8080 plus restored desktop
   before root rollback. Atomically exchange the current r9 directory
   with the verified prior stage2 directory (at the candidate path if
   step 4 did not archive it, otherwise at `r9-stage2.AppDir`).
   Preserve the rejected stage3 directory at its resulting unique
   path for diagnosis, verify all 726 old root hashes and restart
   the old r9 via this login's PM2 script. Verify actual browser,
   listener and desktop state; do not restore the old lock backup
   over Chrome's newer lock. If either stop or rollback gate fails,
   leave playback stopped and report the exact failure instead of
   attempting an unsafe second start.

Stage3 passing unit tests and a short real-browser check will not be
called a representative soak. Before claiming long-duration acceptance,
record a representative-duration continuous run, resource/error and
recovery counts, a corrected post-login desktop-entry check, and the
on-site visual outcome. Keep every failed observer log and all ignored
evidence and r8/r9-stage1 rollback releases. The later explicit source
integration decision below permits worktree removal after evidence backup.
The first approved stage3 maintenance attempt authenticated sudo in the
same SSH PTY and stopped PM2, then failed the user-level process gate:
`PermissionError: [Errno 13] Permission denied: '/proc/1764/exe'`.
The rollback path encountered the same observer failure. Preserve the
entire `evidence/r9-stage3-maintenance-20261030T233132Z.log` (UTC).
No root install/exchange occurred. Independent checks found stage2 still
installed, no candidate directory, one stopped PM2 definition, zero 8080
listeners, revision-2 inactive lease, visible panel and active RustDesk.
Unreadable same-UID executables included systemd, sd-pam, ssh-agent and
tailscaled; their command names alone do not prove a zero-process gate.
Linux documents the ptrace access check for `/proc/pid/exe` at
https://man7.org/linux/man-pages/man5/proc_pid_exe.5.html.

The user separately authorized continued downtime and corrected stage3
deployment. Preserve both original operator scripts; use the `-v2`
copies in ignored evidence and user staging. The v2 preflight requires
the **stopped** PM2/idle desktop/zero 8080 state and old 726 root hashes.
After authentication, a root **read-only** `idle` action must inspect
all executable links and reject any process from the releases directory.
Do not ignore PermissionError or relax system ptrace/security settings.
Only after this privileged gate passes may the existing install/rollback
sequence run. Every subsequent rollback/stop gate uses the same root
inspection; PM2 itself still runs only as the exhibition user. A failed
root gate leaves playback stopped and requires operator review.

The second r9 video reset was observed after 871.14 seconds, exit 0,
with 19676 frames and 2055 dropped (10.44%). All 13 original image
searches loaded and scrolled in the earlier 151-sample run without an
observed challenge. Some later spot samples could not read unrelated
`/proc` entries; do not count those as successful observations. The user
witnessed the complete run and accepted its apparent smoothness. Requested
browser rectangle (0,0,2160×1920) measured (18,0,2158×1920); this
deviation is provisionally accepted, not exact geometry. The PM2-managed
120-second run had one app/listener and an active lease; the user witnessed
audio, click-through and the dual-screen seam. PM2 stop released the owned
processes and port 8080 and restored the desktop. Subsequent login did
start PM2, but browser reliability and continuous soak are not verified.
Preserve both the failed first-cycle
`evidence/r9-stage2-full-cycle.log` and the passing second-reset
`evidence/r9-low-impact-observer-20261030T164926Z.log`.

### Stage3 installed and recovery verified (2026-10-31T00:44:35+0100 CET)

The user approved continued downtime after the first observer failure.
The v2 run authenticated in the same SSH PTY, passed the privileged
zero-release-process/zero-8080 gate, installed stage3 atomically and
preserved old stage2 at `/opt/transplayer/releases/r9-stage2.AppDir`.
The existing user supervisor restarted one unbounded PM2 player with
the current graphical login and revision-2 lease. Independent read-only
checks verified all 726 hashes of new and rollback root releases,
plus installed recovery source hashes. Complete maintenance evidence:
`evidence/r9-stage3-maintenance-v2-20261030T233554Z.log`.
The interactive tool did not provide a separate exit code; deployment
is supported by PASS markers and independent installed/live checks.

Read-only se_13 inspection verified owned loopback debugger, Google
images, 204 loaded images, scrollY 2426 and accepted geometry (18,0),
2158x1920, with no challenge in this sample
(`evidence/r9-stage3-real-search-first.log`, exit 0).
The approved rehearsal checked exact executable, UID, ancestry under
the player, process start time, dedicated profile marker, current lock
and socket ownership before sending **one SIGKILL via pidfd to only
the se_13 Chrome main process**. A stale same-host lock was observed.
At 118.2 seconds the new browser had 68 loaded images and scrollY 197;
at 129.1 seconds, 79 loaded images and scrollY 566 proved continued
scrolling. New lock identified the new browser; old debugger released,
accepted geometry unchanged, player PID and PM2 restart count unchanged.
`evidence/r9-stage3-real-browser-recovery.log` contains the complete
observations and `STAGE3_REAL_BROWSER_RECOVERY_PASS`; runner exit 0.
No lock was manually removed/restored and no profile deleted.
The user confirmed fullscreen search and video overlay looked normal.

This proves one recovery at a subsequent scheduled search event,
**not immediate recovery**, long-term reliability or the original
Chrome-exit cause. Stage3 remains running under the existing PM2
supervisor. Representative soak and complete post-login checks remain
pending. The user subsequently explicitly authorized merging into the
existing `master`, removing the isolated worktree after full evidence
preservation, and pushing to origin before the proposed eight-hour soak.
This changes the source-integration gate only, not the recorded test
results or the outstanding exhibition reliability acceptance.

### Gate, rollout and rollback

From the *current graphical login*, require exactly one logged-in GNOME
session, two 1080×1920 portrait outputs at x=0 and x=1080, RustDesk
active, extension Status revision 2, inactive lease and visible panel,
**zero** r8/r9 players and **zero** 8080 listeners. A single stopped PM2
definition is allowed; an online, errored or foreign definition is a
stop-and-inspect condition. Verify the 726-entry root r9 manifest and
preserve r8, r9-stage1, the private backup of both desktop entries and
extension, and the current r9 executable. Recheck activity immediately
before *each* startup or entry swap. Abort on any mismatch.

Copy `packaging/pm2-session.sh` alongside the matching
`ecosystem.config.js` and `packaging/pm2-launch.sh` into the user-owned
`~/.local/share/transplayer/supervisor/r9-20261030-login-safe/` and verify source
and installed SHA-256 and executable permissions. Do not modify the
root AppDir. `pm2-session.sh login` requires this login's `DISPLAY`,
`XDG_RUNTIME_DIR`, session bus and readable `XAUTHORITY`. An online app
from **the same** supervisor and the same Xwayland login is left untouched;
an old online process with another authority or executable is rejected,
not silently adopted. A stopped definition is replaced using
fresh credentials **only after** the idle revision-2 desktop check prints
`DESKTOP_READY`. An empty isolated PM2 state is also allowed. The result
must be exactly one online `transplayer`, one localhost:8080 listener
and one active lease; separately check video progress and image loading.
On failure stop only this PM2 definition and require zero owned player,
Chrome, Driver, debugger and 8080 listeners, inactive lease, visible panel
and restored Dock. Do not proceed to launcher/autostart cutover.

**Never use `pm2 save`, `pm2 resurrect`, root `pm2 startup`, or a system
service**: a saved process can retain stale Xwayland authority from an
earlier login. The stopped 120-second test definition must not be saved.
Before unbounded login startup, verify the newly created app has no
`TRANSPLAYER_SMOKE_SECONDS`. After the live current-session wrapper,
scoped stop and disconnect recovery pass, back up both r8 desktop entries
and atomically change *only* their `Exec` targets to the installed
`pm2-session.sh start` / `pm2-session.sh stop`; verify executable/trusted
metadata and real desktop-entry activation. Only then install one
user-owned XDG autostart `.desktop` invoking `pm2-session.sh login`.
Coordinate the next login/reboot with the user: do not force it remotely.
After login, verify no keyring prompt, one unbounded app/listener, the
same lease, real image/video progress and clean stop. Until then, autoplay
is **pending**, not verified.

With PM2 active, stop via the Stop desktop entry or
`~/.local/share/transplayer/supervisor/r9-20261030-login-safe/packaging/pm2-session.sh stop`;
require one stopped app, zero owned descendants and port 8080, inactive
lease, visible panel and restored Dock. For an *unsupervised* direct run
only, use `/opt/transplayer/releases/r9.AppDir/AppRun --stop` or Ctrl+Alt+Q.
Do not directly `--stop` a PM2 app: PM2 can restart it. If normal stop
fails, prevent PM2 restart first, identify the exact current user-owned
player PID, parent and descendants, send TERM **only** to that verified
PID and check again. KILL of the same verified PID is a last resort
after TERM fails. Never use broad `pkill`, delete a Chrome profile or
stop RustDesk. Rollback disables only this autostart entry, stops the
PM2 player, atomically restores backed-up r8 desktop entries and trusted
metadata, and verifies their r8 targets and the idle desktop. r8 is a
launcher rollback, **not** a CAPTCHA-free search fallback. Retain all
releases, backups, private PM2 state and evidence.

The first abnormal-disconnect rehearsal failed *automatic restart* even
though SIGKILL of the verified player PID released the desktop lease and
restored the panel: PM2 7.1.1 logged SIGKILL as exit code 0, and the
original supervisor exempted both 0 and 78 from restarting. The process
was stopped cleanly afterward; keep the complete failure and traceback
in `evidence/r9-pm2-abnormal-recovery-20261030.log`. TDD changed only
the recovery version's `stop_exit_codes` to `[78]`: an explicit
`pm2-session.sh stop` remains the normal stop, while an unexpected
exit code 0 must restart. Do not promote desktop entries or autostart
until this *new* version passes a fresh bounded on-host disconnect test.
The previous `r9-20261030` supervisor remains an unmodified diagnostic
artifact, **not** an acceptable auto-recovery configuration. The separate
`r9-20261030-recovery` version passed a bounded abnormal-disconnect test:
one verified PID was killed, the GNOME lease released, PM2 restarted a
single player with a fresh lease, and scoped stop restored zero owned
processes/8080 (see `evidence/r9-pm2-recovery-live-20261030.log`).
Before enabling next-login startup, a further stale-online-auth regression
passed 9/9 and the complete suite passed 93/93, both with zero failures
or skips (`evidence/r9-pm2-login-safe-green.log`,
`evidence/r9-pm2-login-safe-full.log`). The installed `login-safe` script
refuses an old online app's credentials. Original r8 desktop entries
were backed up privately under
`~/.local/share/transplayer/backups/r9-desktop-20261030T220102Z/`;
the next r9-entry version was also backed up. Both final trusted desktop
entries passed real bounded `gio launch` start/stop, duplicate login and
complete cleanup (`evidence/r9-login-safe-desktop-live-20261030.log`).
The installed autostart entry manually launched a single bounded app
and was stopped via the real Stop entry, with desktop and port restored
(`evidence/r9-pm2-autostart-manual-probe-20261030.log`). This does
**not** prove unattended next-login startup or a cold-keyring result.

## Historical r8 deployment and r9 candidate record

## Baseline and runtime gate

1. Verify RustDesk active, one active local desktop session, no existing
   Transplayer process and zero listeners on port 8080. Abort on mismatch.
   This fresh machine has no prior Transplayer service; if one appears,
   stop and inspect rather than replacing it.
2. Create a private versioned backup directory (0700), with existing
   monitors.xml, Transplayer config/shortcuts and GNOME settings saved
   privately (0600). Record absent files explicitly. Never print secrets.
3. Require artwork video SHA-256
   `432aa9a2602c47f6ad86adc7eec26f3e912e81f196b1a19f6245a917dc9544d7`.
   Use the existing webm in place; do not modify the mov or video content.
4. Reconstruct Electron 9.3.2 Linux x64 from its official release archive
   and official SHASUMS256.txt. Require an exact matching SHA-256 before
   extraction. Build tools live in the user's private staging directory.
5. Run version/dependency checks and a bounded GUI probe on the current
   Xwayland desktop. Require real window creation, transparent/click-through
   behavior and clean exit; version output alone does not pass.
   Save stdout/stderr and stop at any loader/sandbox/runtime failure.
   No --no-sandbox, global AppArmor changes or unapproved runtime upgrade.

## Desktop integration and geometry

1. Tests first for the GNOME 49 integration: normal acquisition/restoration,
   invalid identity/PID, duplicate ownership, caller disconnect, and
   extension disable. No arbitrary JavaScript evaluation endpoint.
2. Install a user-scoped extension only after the runtime gate passes.
   Require ENABLED state and successful bounded acquire/release before
   production playback. Preserve the legacy GNOME 3.28 implementation.
   If login is needed to load it, coordinate with the user first.
3. Save the current Mutter display configuration. Temporarily apply
   DP-1 and HDMI-1 rotated left at (0,0) and (1080,0), scale 1.
   Require two 1080x1920 outputs and total 2160x1920, plus working RustDesk.
   Save persistent configuration only after verification.
4. Verify panel restoration and native Dock shown/hidden/shown while the
   transparent player alone does not count as an overlapping window.
   Failure must restore original hooks and settings, not leave a hidden UI.

## Versioned release and playback

1. Create new r8 source/AppDir/AppImage paths, never overwrite r7b or
   existing outputs. Browser/driver 156.0.8078.80 and NopeCHA 0.6.1 must
   match packaging/browser-toolchain.json and package-lock.json.
2. Require full tests, syntax checks, source hashes, AppDir manifest and
   AppImage sidecar verification before starting the release.
3. Use the desktop webm in the external config. First-install shortcuts
   must not overwrite existing files; verify trusted/executable metadata.
4. Start exactly one player and require one localhost:8080 listener,
   expected geometry, advancing video frames/time, startup 775-to-0 and
   a complete 780-second cycle. Log search challenges honestly.
5. Verify normal stop releases all owned sessions/port and restores UI.
   Do not claim audio, physical seam, reboot or soak acceptance.

## CAPTCHA diagnosis after deployment

Use only the exhibition's dedicated profile and official/free services.
Compare actual manual Google image search with the automated timeline;
record URL category, image counts, scroll range/offset, challenge flags,
and extension enabled/errors. Never log cookies, tokens or arbitrary page
text. User may solve an on-screen challenge manually. Do not buy credits,
change proxies, or infer success from extension activation.

## Rollback

Stop only the owned new player normally and confirm process exit and zero
8080 listeners. Restore the extension hooks, panel and backed-up display/
config/shortcut settings as applicable. Disable only our own extension if
necessary. Keep staged outputs and logs for diagnosis. Leave RustDesk
running and videos untouched. If rollback cannot be verified, leave the
player safely stopped and report the exact failure.

## Evidence

Official Electron archive SHA-256 passed:
`0534f469f5048a6ce920af420275ee4f715c3a6a58cae05b805b241f4e3753b2`.
Activity/8080, private backup and video checks passed. Backup is inside
the private stage `~/Documents/transplayer-staging/r8-20261030T131505Z/backup`.

First GUI probe exited 127: missing libXss.so.1. User explicitly approved
installing libxss1; only that package was added. Second probe exited -5:
No usable sandbox. Complete logs are `evidence/ubuntu25-runtime-gate.log`
and `evidence/ubuntu25-runtime-gate-v2.log`; failures are not a passed gate.
Kernel records showed Electron userns_create followed by AppArmor capable
DENIED under unprivileged_userns. System restriction remains enabled.

Formal playback, extension and portrait-display changes have not started.
Approved follow-up: root-owned fixed version AppDir under
/opt/transplayer/releases with exact Electron/Chrome AppArmor userns profiles.
This replaces the new-host AppImage entrypoint. Never use a writable
executable path or broad wildcard profile.

User approved a separate Electron45.1.0 test/upgrade after Electron9's GPU
subprocess crashed six times despite its successful userns profile.
Root-owned compatibility runtimes and exact profiles exist for 9.3.2 and
45.1.0 under /opt/transplayer/compat and /etc/apparmor.d. No global sysctl
or sandbox disable was applied. Electron45 passed bounded Xwayland window
creation and normal exit; transparency/click-through acceptance is pending.
See `evidence/ubuntu25-electron45-gate.log`; all Electron9 failures retained.

Clean Node24.22.2 bootstrap and locked browser archives passed.
Full tests: 50 pass, 0 fail, 0 skipped (`evidence/ubuntu25-bootstrap.log`).
User-stage bundle has 725 verified manifest entries at
~/Documents/transplayer-staging/r8-20261030T131505Z/portable-r8-stage1.AppDir.
This is not a promoted /opt release. Its source snapshot predates latest docs.

User extension files installed, but current Shell reports extension does not
exist. Await a coordinated local logout/login, not a forced desktop restart.
RustDesk remained active; display rotation and formal playback not started.
GJS API checks passed with a deprecation warning for Gio.UnixInputStream.

### Post-login deployment (2026-10-30T14:25:56Z UTC)

User confirmed local logout/login. Extension discovery and enabling passed:
ACTIVE, no lease, panel visible. Foreign PID acquisition was rejected with
Desktop process identity mismatch and no UI mutation. Root release was
installed atomically, exact Electron/Chrome AppArmor profiles loaded, and
725 hashes/root permissions independently rechecked. Global userns
restriction remains1. Installer created config0600 and two executable,
trusted launchers; actual desktop-entry execution remains pending.

Fixed-hash installation archive SHA256:
`906710c32d6c437a2b6f73e93f93644fda8f1f70b84516225a8cfdd10f23dd24`.
Original root AppDir and source-stage1 remain immutable. The live
user-scoped extension was subsequently patched separately; do not replace
it from the bundled old gnome49 directory.

Mutter verify and temporary apply passed: DP-1 left rotated at0,0 and
HDMI-1 left rotated at1080,0, scale1, total2160x1920. RustDesk active.
Original state saved privately in backup/pre-portrait-state.gvariant.
Persistent saving awaits actual screen/RustDesk confirmation. Re-query
geometry after the next login; temporary state may not survive it.

Bounded playback failed before video startup:

    GDBus.Error:org.transplayer.Desktop.Failed: Desktop process identity mismatch
    Error: Desktop guard exited: 1
        at ChildProcess.<anonymous> (/opt/transplayer/releases/r8.AppDir/app/main.js:107:20)
        at ChildProcess.wrapper (node:events:639:12)
        at ChildProcess.emit (node:events:514:28)
        at ChildProcess._handle.onexit (node:internal/child_process:324:12)

Exit1; zero listeners, no lease and visible panel after cleanup.
evidence/ubuntu25-playback-smoke.log retains the full runner failure.
Scoped process diagnostics confirmed the main Electron45 process rewrites
its argv into one title:
executable, the three exact AppRun flags, then app directory. UID, ancestry,
root-secure executable and guard script matched. The old separate-argv
player check therefore rejected the legitimate process.

Regression test failed first (8 pass/1 fail), then exact-title support passed
the full local suite52 pass/0 fail/0 skipped. Hostile lookalike paths, altered
flags and extra arguments remain rejected; other trust checks unchanged.
Updated user lease.mjs SHA256:
`9f4f180415083a0b030b70f4f6f9d3250cbefe24599216307d2f14da88d6fbc9`.
Old user extension preserved at backup/extension-before-title-fix.
No root release files were overwritten.

Shell ReloadExtension is deprecated and does not work; independent
Extensions service also exposes but does not implement it. Official GJS
documentation confirms cached JavaScript needs a fresh Shell; Wayland
requires coordinated logout/login. Updated code is on disk but not yet
executed in Shell. Await another user-performed login, not an automatic
desktop restart. Final safe-state evidence confirms no player/8080,
panel visible and RustDesk active.

Evidence: ubuntu25-portrait.log, ubuntu25-identity-debug.log,
ubuntu25-title-red.log, ubuntu25-title-green.log,
ubuntu25-extension-reload.log, ubuntu25-post-login-safe-state.log under
the local ignored evidence directory. Positive lease, actual video,
click-through, native Dock behavior, full cycle and CAPTCHA remain pending.
Reference: https://gjs.guide/extensions/development/debugging.html

### Second-login live checks (2026-10-30T15:07:31Z UTC)

User confirmed another login; prior TEMPORARY rotation reverted to landscape.
Extension ACTIVE with patched lease loaded. Two persistent DBus attempts
did not produce monitors.xml: first immediate read raised FileNotFoundError;
second waited25seconds and failed confirmation/write assertion. Both rolled
back; full failures retained in ubuntu25-portrait-persistent.log and -v2.log.
No claim that merely sending method2 saved the layout.

After verifying actual connected specs and mode IDs, applied the verified
temporary left-portrait pair and atomically wrote the documented GNOME
user store ~/.config/monitors.xml (0600, version2, actual monitor identities,
native1920x1080@60 modes transformed left). Original absence recorded and a
versioned private XML retained in backup. Exact file content was read back.
This saves a native user configuration without system/GDM edits; its loader
on a subsequent login is STILL UNVERIFIED. If not accepted, stop playback,
restore baseline display state and preserve the rejected file as evidence.
Reference: https://github.com/GNOME/mutter/blob/main/doc/monitor-configuration.md

Short playback-v2 exited0: actual2160x1920 window, metadata780seconds,
775-to-0 and progressing frames/time, one listener and active hidden-panel
lease. Normal stop restored panel, released lease and port. GJS emits
deprecation warnings for Gio.UnixInputStream and GLib.unix_signal_add;
these did not fail the test and have not been changed in immutable r8.

Packaged-browser synthetic page passed640x600 window and scroll400px.
Requested x20/y20 yielded x20/y22 while the top bar was visible; this is not
proof exact positioning at every y. Probe used isolated browser-probe-profile,
retained for diagnosis after clean WebDriver quit. NopeCHA0.6.1 registry:
ENABLED, errors0. All six10second Google samples showed sorry/recaptcha,
0images,0loaded,0scrollRange,0offset. No CAPTCHA success.

First full observer timed out at fixed805seconds before a second reset:
video last755.197163, exit0 and restored UI, but observer exited1:

    Traceback (most recent call last):
      File "/home/elephant/Documents/transplayer-staging/r8-20261030T131505Z/full-cycle-observer.py", line 111, in <module>
        assert times and times[0] >= 775 and resets >= 2, ("Full cycle not demonstrated", resets)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    AssertionError: ('Full cycle not demonstrated', 1)

Second observer used actual two-reset completion, normal SIGTERM stop,
hard1000second application limit and1050second observer deadline. No
timecode, playback rate or search timeline changed. First video observed
at2.03seconds wall time; second reset at817.86seconds. Both startup775-to-0
and subsequent complete780second video cycle demonstrated:

    FULL_VIDEO_CYCLE_PASS startup_775_to_0_and_complete_780s resets=2
    SMOKE_EXIT 0 RESTORED {"active": false, "panelVisible": true, "dockSlides": [null]} LISTENERS 0

Last video sample: time0.007013,19676frames,854dropped (~4.34%).
Main-process RSS167984–170212KiB (not total application RSS).
41search samples:40challenge pages, maxLoaded0/maxOffset0; unavailable
sample explicitly recorded. This passes VIDEO cycle/restoration only,
not live image search, physical transparency, audio, seam, reboot or soak.
Actual wall duration and dropped frames remain performance concerns.

Evidence: ubuntu25-portrait-user-config.log,
ubuntu25-playback-smoke-v2.log, ubuntu25-browser-probe.log,
ubuntu25-full-cycle.log (failure retained), ubuntu25-full-cycle-v2.log.
No player intentionally left running. Next diagnostic requires a regular,
non-WebDriver Chrome dedicated profile and user-performed challenge test;
do not use private profiles, buy credits or silently change search engine.

### Manual versus WebDriver comparison (2026-10-30T15:19:57Z UTC)

Opened packaged Chrome normally at15:15:21UTC, independent private-permission
manual-chrome-20261030T151521Z profile, no WebDriver/debugging flags or
NopeCHA. User confirmed image results were visible. User did not confirm
refresh stability or whether a challenge was manually completed.

The first identity gate rejected Chrome's rewritten single-title cmdline;
no signal was sent. Read-only inspection confirmed the exact known command.
Then sent SIGTERM only to the verified owned main PID21216; it exited but
left a SingletonLock. The next gate stopped at Profile still locked.
Do NOT describe this as a clean Chrome-profile shutdown just because the
old marker said GRACEFUL_STOP_PASS. No lock was manually deleted.
After verifying no profile user remained and lock referred only to the
dead owned PID, let Chrome itself recover its stale lock.

WebDriver reopened the SAME profile/same Chrome, without NopeCHA, for the
same world-news Google image URL. Four5second samples all returned:
/sorry/index,recaptcha true,0images,0loaded,0maxY,0offset. quit awaited.
This rejects "just reuse the working manual profile" as a demonstrated fix.
The discrepancy is in the WebDriver launch path/added options or another
time-varying factor, not proof of a single detection mechanism. Normal
refresh, reverse comparison and any alternative control backend remain
unverified. No production flags/controller behavior were changed.

Evidence: ubuntu25-same-profile-probe.log (first identity gate failure),
ubuntu25-same-profile-probe-v2.log (stale-lock gate),
ubuntu25-same-profile-probe-v3.log (four actual observations and quit).
Later broad command-text holder check matched its own parent shell and
stopped; corrected check scoped to the actual Chrome executable found
zero profile holders. Final8080zero/RustDesk active. All test windows closed,
profile/evidence preserved; no cookies/tokens read or exported.

### Chrome-first attach prototype (2026-10-30T15:27:12Z UTC)

Status: documented successful spike, NOT promoted. User approved this bounded
experiment with CAPTCHA resolution as priority. Code isolated under
experiments/captcha-attach/probe.js, no production controller changes.
Official ChromeDriver debuggerAddress and non-default-profile guidance
checked; existing Selenium's withCapabilities used (no version upgrade).

Fresh private attach-profile, packaged Chrome156 launched first with a
nonzero dynamically selected debugging port. Independently verified
/proc/net listener bound127.0.0.1 ONLY, no wildcard/remote binding.
No NopeCHA, stealth packages, navigator overrides, proxy or paid service.
Only bounded page-count metrics collected, no cookies/tokens/page body.

Before WebDriver attached, two samples: Google/search,229images,
62loaded,maxY4985,y0,no challenge. Immediately after attach: same values.
After refresh:62loaded, y0→392→792, scroll range4666/4658, no challenge.
Second query elephant:228images,59loaded,maxY5075,y0, then scroll400,
maxY5067,no challenge. Eight observations total,0challenge.

    ATTACH_EXPERIMENT_RESULT {"images":true,"scroll":true,"challengeSamples":0}
    ATTACH_EXPERIMENT_CLEANUP_PASS profile_preserved

Window command did not throw, but requested0,0/1080x1920 yielded18,22/
1079x1919 while panel visible. Do not accept this as exact artwork geometry.
Further candidate work must verify with exhibition desktop lease active.
Awaited driver quit, Browser.close and child exit; debugger listener zero.
Independent later check:0attach Chrome processes/0player8080/RustDesk active.
Private experiment profile retained; no data deletion.

Evidence: evidence/ubuntu25-attach-probe.log. Two searches/one refresh do
not prove all13queries or long-term CAPTCHA freedom. Current root r8,
AppArmor profiles, launchers and GNOME code remain unchanged.
Production promotion requires reviewed r9 plan, TDD for lifecycle and trust
boundaries, new immutable root release and precise profiles, explicit
r8/r9 GNOME executable allowlist, coordinated login and full timeline check.
No paid solving, proxy changes or sandbox disabling in that plan.

Official references:
- https://developer.chrome.com/docs/chromedriver/help/operation-not-supported-when-using-remote-debugging
- https://developer.chrome.com/blog/remote-debugging-port

## Approved r9 deployment protocol

Production TDD plus versioned/hardware verification. User approved the r9
integration plan after the successful prototype. Do not promote prototype
code directly or overwrite root r8. Current source adds chrome-session.js,
chrome-first backend and an exact r8/r9 GNOME allowlist. No timeline edits.
Local full suite73pass/0fail/0skipped; r9-session-red.log and
r9-controller-red.log retain all initially failing tests; green in
r9-full-green.log. This is not yet deployed behavior.

1. Require0existing player and0port8080, RustDesk active, no active desktop
   lease. Back up current extension/config/launchers privately before changes.
2. Build a new source snapshot and r9 AppDir with the same locked runtime/
   browser archives. Verify every source and bundle hash, dependency version,
   full Linux suite and syntax before a fixed-hash root installation.
3. Before playback, test the actual new session/controller against root r8
   Chrome/Driver in a dedicated probe profile: real images, refreshing,
   scrolling, geometry and repeated close/reopen. Require all owned Chrome,
   Driver and debugger ports released. Failure stops promotion.
4. Install new root-owned /opt/transplayer/releases/r9.AppDir with precise
   Electron/Chrome AppArmor profiles. Preserve r8 and its policies; no
   user-writable executable allowance or global sandbox/sysctl change.
5. Save old user extension, install matching new extension and coordinate
   user logout/login for JS cache. Do not force logout/reboot. After login
   require extension ACTIVE, rejected foreign acquire and persisted portrait
   geometry. Mixed-version/unapproved executables must remain rejected.
6. Run r9 bounded playback, inspect exact requested/result window geometry,
   real image counts and scroll, then startup775-to-0 plus complete780s video
   and every original query. Record CAPTCHA honestly. Require normal and
   parent-disconnect cleanup:0owned Chrome/Driver/debugger/8080, UI restored.
7. Only after candidate checks, back up and switch desktop entries to r9;
   verify actual Start/Stop execution and exact targets. Keep rollback to r8
   (whose search CAPTCHA limitation remains). Do not reinstall config blindly.
8. Rollback stops only owned r9 processes normally, confirms freed ports,
   restores backed-up launchers/config and extension when necessary. A
   changed extension also needs coordinated login. Keep new artifacts/logs,
   media and old releases untouched. Do not claim soak/boot/audio/physical
   appearance acceptance from these checks.

### r9 candidate installed (2026-10-30T15:45:59Z UTC)

Red confirmed: initial session/allowlist25tests9pass16fail; new controller/
actual-socket hardening26tests20pass6fail. Complete current local and
clean Linux suites both73pass0fail0skipped. Linux bootstrap reused pinned
Node24.22.2 and official Electron45 runtime; npm ci --ignore-scripts,
no global installs or dependency upgrades. Source53files SHA256:
d6126991b02e83d6f7c5c056d71a0a3e48495b009c96db5a66dba3545c6dddbf.
All source hashes, syntax, diff and gitleaks checked.

Actual new source/controller tested against root r8 binaries BEFORE promotion:
world news61loaded/elephant59loaded, refresh and scroll400, two clean closes
and same-profile reopen. Then builder produced726manifest entries;
independent verification passed. Fixed installation archive SHA256:
db7c228b51e157dee2e372b5221fb12437554c0a53982a122f6f5ff10be8fc58.
Root strict extraction/atomic rename installed r9.AppDir; exact
transplayer-r9-electron and transplayer-r9-chrome profiles loaded.
Independent root ownership/permission/hash verification726passed,
global userns restriction remains1. r8 not overwritten.

Private baseline backups: existing stage/backup/r9-transition, containing
old extension, config, monitors.xml and both desktop entries. Old extension
bytes matched backup immediately before atomic per-file installation from
the verified root r9 gnome49 directory. Source-stage1/root r9 immutable;
latest README/runbook edits are newer and not included in that snapshot.

Installed extension hashes:
extension.js38f1816fea19ba1c9a3cb873578f80d304d7b5b351fe2a8a28559059d87491da;
lease.mjs8f256199f1e99bbec4fbe8a384c007a01d61258b139b995d1be4eea978ec2e83.
Old Shell is still cached (Status lacks new dockOverlap field); no reload
attempt or forced logout. Await coordinated user login and verify that
field, ACTIVE state and both exact release identities. Recheck native
portrait persistence after login before any display rewrite.

Actual ROOT r9 controller/runtime/Chrome/Driver also tested: world news62,
elephant59loaded, refresh successful, each scroll400, no challenge;
synthetic640x600 at20,30 exact, two close/reopen cycles passed. This does
not establish full artwork geometry or all13queries. Final independent
check found0r9processes,0port8080, panel visible/no lease, RustDesk active.
Desktop launchers still point r8; config unchanged. r9 full player not
started because old extension does not yet authorize its executable.

Evidence: r9-session-red.log, r9-session-green.log,
r9-controller-red.log, r9-full-green.log, r9-linux-bootstrap.log,
r9-controller-live.log, r9-build.log, r9-root-and-extension.log,
r9-root-controller-live.log and r9-source-gitleaks.log.
Next: user logout/login, bounded r9 AppRun, native Dock/geometry and
original query observations, full video cycle, disconnect/normal stop,
then backed-up launcher switch and actual Start/Stop verification.

### Stage2 corrections and pre-deploy protocol (2026-10-30T15:56:20Z UTC)

User rebooted and confirmed automatic login configuration. Actual live
session, RustDesk, extension ACTIVE and persisted two-left-portrait geometry
passed. No auto-login/GDM change by agent. First full r9 attempt failed:
Unsupported Ubuntu Dock API / Desktop guard exited1, player exit1,
UI restored/8080zero. Same cached code re-enabled after Dock ready then
passed playback,775→0, two real searches/scroll and normal restoration.
This isolates an enable-time empty/stale Dock capture; do not permanently
work around it by disabling/re-enabling every boot.

world news outer rect was2158x1920 at18,0 instead of2160x1920 at0,0;
elephant news1620x1620 at500,180 matched. Geometry remains UNACCEPTED.
Initial observer printed unavailable for unrelated inaccessible /proc entries;
fixed to report only after recognizing this application's Driver.
Original failed/noisy logs r9-playback-smoke.log and -v2.log preserved.

User separately approved only dedicated Chrome-first basic password store,
with plain-text-storage tradeoff explained. Never store/type credentials.
New stage2 profile root profiles-r9-basic, no reuse of private/old keyring
profiles. System keyring/RustDesk/sudo left alone. Keyring was already
unlocked when checked, so no cold-start prompt-free claim yet.

Stage2 TDD:29tests25pass4fail first, then full76pass0fail0skipped.
Dock is resolved on each acquisition; no stale fallback, each lease restores
its original target hooks. Extension metadata/Status revision2 will identify
loaded code. No trust-boundary relaxation.

Deployment: preserve immutable source-r9-stage1 and root r9 bytes. Build
new source/AppDir/archive stage2 and verify726manifest. Require zero r9
processes/8080, no lease, RustDesk active and private stage2 transition backup.
Extract via fixed-hash sudo command into a NEW root directory; verify all
hashes/permissions first. Linux renameat2 RENAME_EXCHANGE atomically swaps
new candidate with fixed r9.AppDir, then archives original root directory
as r9-stage1.AppDir. No file deletion/in-place edits, exact AppArmor path
unchanged. Rollback exchanges verified old directory back only after
activity gate. Keep r8/entries/config unchanged until acceptance.

Install matching user extension from verified new root bundle after backup.
Need coordinated logout/login to load revision2; do not force restart.
Then verify cold-start no prompt with the user, dynamic Dock readiness,
Google images/scroll, full original timeline, exact geometry and cleanup.

### Stage2 installed and basic-store live check (2026-10-30T16:04:39Z UTC)

Additional dedicated-profile safeguard first failed, then passed: accept an
empty new directory and create private .transplayer-profile marker, or
reuse a matching explicitly claimed exhibition directory. Reject unrelated
existing profiles rather than applying basic storage to them. Current
complete Mac/Linux suites77pass0fail0skipped. No credentials stored/typed.

New source53files SHA256:
7c6d6da0eda761987289db43a11eee5f420f8d80fa4c9d31bb145def73a3e894.
Stage2 release archive SHA256:
06f5d25894ea05557084e66b2eff8593fa0d9a13b9d95ecb149375150acf4a03.
Fixed-hash strict root extraction verified726files, rename-exchange switched
the candidate atomically. Original retained as root r9-stage1.AppDir with
original manifest SHA256:
374d7b2c521a7e07f156c2b27e651cdd4fa58248231b002a84837bdd6ae65732.
Independent new726hash/ownership verification passed. Existing precise
AppArmor profiles/global restriction unchanged, r8 untouched.

Stage2 private backup: backup/r9-stage2-transition in existing stage.
Installed extension metadata version2 and Status.revision2 (on disk).
extension.js SHA256:
9c1fa109110fb45474c40dfb2c9ad1f5292067d14bb732ceccf3d089f7a85ba3;
lease.mjs:
df837768ef5944014e45a70a6ed7f0a910052a5a897ba685c64c8d1a22ca45c0.
Current Shell is still revision1 (no revision field); cached code was
re-enabled earlier as a diagnostic only. Still requires coordinated fresh
Shell for dynamic-Dock revision2; do not claim this boot path verified yet.

Actual installed stage2, fresh r9-basic-controller-profile: verified live
--password-store=basic, world news62loaded and elephant59loaded, each
refresh/scroll400 successful/no challenge, same dedicated profile closed/
reopened twice and all owned resources released. This checks browser
functionality, NOT cold-keyring behavior since current keyring was unlocked.
Final no r9 processes/8080zero, panel visible/no lease, RustDesk active.
Desktop launchers remainr8 and config unchanged.

Evidence: r9-stage2-build.log, r9-stage2-installed.log,
r9-basic-controller-live.log, r9-basic-profile-red.log,
r9-stage2-full-green-v2.log, r9-stage2-gitleaks.log.
Immutable snapshots predate this latest documentation. Next: user fresh
login/reboot, verify revision2, portrait persistence/no keyring prompt,
then precise geometry/complete original query timeline and launcher switch.

### Stage2 full-timeline observation and geometry decision (2026-10-30T17:37:05+0100 CET)

After a coordinated fresh login, extension Status reported revision2 and
the player acquired a lease; on exit the panel was visible, lease inactive
and port 8080 listener count zero. The r9 candidate is not the desktop
launcher target; r8 remains installed and unchanged.

The user accepts the currently observed browser-window geometry deviation
provisionally and prefers to revisit it only if the visual result is poor.
Default requested rect (0,0,2160,1920) measured (18,0,2158,1920);
the six explicitly positioned/sized query windows measured their expected
rects. This relaxes the blocking priority of *exact browser positioning*,
not the physical display layout, seam, transparent/click-through operation,
playback duration, or recovery checks. Record the visual result on-site.

The full-timeline run recorded 151 search samples, all 13 original queries
loaded images and scrolled, and no observed CAPTCHA; one temporary
R9_LIVE_SEARCH_UNAVAILABLE was logged. The player returned 0 and restored
the desktop, but the observer exited 1: only one reset was observed and
the last playback sample was currentTime 660.01043 (16677 frames, 7089
dropped). The test ran with TRANSPLAYER_SMOKE_SECONDS=1000, so playback
ended before a second reset; the separate observer safety deadline was
1050 seconds. This does not establish why video time advanced slower than
wall time. No video-cycle or performance acceptance is claimed. The exact
failure at the end of `evidence/r9-stage2-full-cycle.log` is:

    Traceback (most recent call last):
      File "/home/elephant/Documents/transplayer-staging/r8-20261030T131505Z/r9-stage2-full-observer.py", line 130, in <module>
        assert resets >= 2
               ^^^^^^^^^^^
    AssertionError

Before promotion, independently repeat the two-reset check with bounded,
less intrusive observation and log frame drops and process cleanup.
Physical appearance, audio, disconnect recovery, soak and boot/autostart
remain unverified. Do not discard this failed run or relabel it as success.

### r9 candidate acceptance gate before PM2 promotion

This protocol precedes any change to desktop entries or automatic startup.
The user authorized continuing on the replacement exhibition host. Recheck
at the actual time of each run; a previous idle check does not authorize
interrupting another user's player. Run as the exhibition user, never root.
Stop immediately at the first unexpected result and leave both launchers on
the known r8 targets. Keep all numbered evidence under the ignored
`evidence/` directory; every run uses a new exclusive log name.

1. Require one active graphical session with authenticated Xwayland, two
   portrait monitors: DP-1 1080x1920+0+0 and HDMI-1
   1080x1920+1080+0; `rustdesk` active; extension Status.revision=2,
   active=false, panelVisible=true; exactly zero release r8/r9 players
   and zero LISTEN sockets on TCP 8080. Do not disconnect RustDesk,
   disable the extension, close other windows or silently fix a mismatch.
2. Require `/opt/transplayer/releases/r9.AppDir/AppRun` executable and
   its SHA256SUMS to verify exactly 726 files with no failure; preserve
   `/opt/transplayer/releases/r8.AppDir` and the complete
   `/opt/transplayer/releases/r9-stage1.AppDir` rollback. Confirm the
   private stage backup `backup/r9-stage2-transition` contains both desktop
   entries and the prior extension. No writable path may become an
   authorized AppArmor executable.
3. Launch only the verified r9 AppRun with the existing exhibition config.
   Use an exclusive per-run log and a bounded video stop; observe PLAYBACK
   metadata 2160x1920/duration780/start775, the first 775-to-zero reset,
   then a second >750-to-<10 reset after one full cycle. Use a wall-time
   ceiling greater than the 1000-second prior failure, with a separate
   hard safety timeout. Do not infer a reset from process exit or test
   timeout. Sample real search results only at a few timeline transitions
   (instead of every 10 seconds) and compare with the prior 13-query,
   151-sample/no-challenge log; do not claim this proves permanent
   CAPTCHA immunity. Record wall time, total/dropped video frames and
   actual browser images/scroll/challenge observations. A high drop rate
   versus the r8 4.34% baseline is an unresolved quality blocker, not a
   cosmetic window-geometry waiver.
4. Stop the owned player normally and require its exit code 0, zero
   owned Chrome/Driver/debugger listeners, zero 8080 listeners, extension
   active=false and panelVisible=true. Verify actual Dock restoration,
   normal Stop launcher/`--stop`/Ctrl+Alt+Q and a separate bounded
   parent-disconnect recovery test; never kill unrelated browser PIDs.
   Audio, physical seam and click-through/transparency require an on-site
   visual/audio witness, and continuous soak/next-login startup require
   their own dated evidence.
5. If any check fails, leave PM2 autoplay and r9 launcher promotion
   disabled; collect exact error and trace, check lease/port/process
   restoration, and keep the original r8 desktop entries and root
   releases. If a player remains, first request its graceful stop;
   force-stop only its verified own PID after preventing PM2 restart.
   The legacy r8 launcher remains a rollback path, **not** a claim that
   r8 Google images work without CAPTCHA. Do not delete media, profiles,
   backups, older logs or the separate worktree until evidence is copied
   and checked.

### Historical PM2 r9 user-session preparation (autostart not yet enabled)

This section records the preparation order. Current witnessed checks and
the no-resurrection login procedure are in the r9 section above. The user
subsequently witnessed audio, click-through and seam in a bounded PM2 run.
Next-login autostart and continuous soak remain unverified.

Use the existing verified Node 24.22.2 from the private stage, copying it
to a permanent user-owned versioned tool directory before any stage
cleanup. Install exactly PM2 7.1.1 (npm-reported package integrity
`sha512-onJNVdGZXz5M1KYk6nekSQz/9ngv2b9dX14QGGF5O+bP55WRxCl603OsqXtzA/xpSDSYDs8f5/2gC38B03GJCQ==`)
with npm scripts disabled and a saved lockfile into a separate user-owned
versioned directory. Neither is a system/global package; no sudo is
required. The explicit paths for this installation are:

- Node: `~/.local/share/transplayer/tools/node-v24.22.2-linux-x64/bin/node`
- PM2: `~/.local/share/transplayer/tools/pm2-7.1.1/node_modules/.bin/pm2`
- PM2 data: `~/.local/share/transplayer/pm2-state`
- Versioned supervisor: `~/.local/share/transplayer/supervisor/r9-20261030/`

Before provisioning require zero existing `~/.pm2` and zero
`~/.local/share/transplayer/pm2-state` processes or dump; do not adopt a
different PM2 instance. Make versioned private copies of the currently
installed desktop entries and the GNOME extension; record expected targets
as r8. Require `--check` on the staged r9 wrapper to exit 0 with
`DESKTOP_READY` and no player/8080; it must reject an absent graphical
session, a stale extension revision or an active lease with exit 78.
Complete Node test suite must pass; keep full red/green logs. Only after
on-site recovery and visual checks may the PM2 session be started by hand
and its one `transplayer` definition inspected. Do not save/resurrect it.
Use the login-scoped script above rather than root `pm2 startup`.

After manual start require one app, one 8080 LISTEN, one active lease with
hidden panel, a real video time/frame increase and loaded search images.
After PM2 stop require app stopped, zero r9 Chrome/Driver/debugger/8080,
lease inactive and visible panel/Dock. Re-run after the coordinated next
login to prove the autostart path and absence of keyring prompts. Do not
save any PM2 process dump as the boot configuration.

Rollback is ordered: stop the `transplayer` PM2 process and verify it
stays stopped; disable only the installation's autostart entry, restore
the versioned r8 desktop-entry backups atomically, and verify their
targets and trusted metadata. Keep PM2's isolated state for diagnosis,
and retain r8, both r9 root releases, media and all logs. If cleanup
fails, do not start a second player or silently signal unrelated
processes. The user's sudo authorization does not permit putting a
password in any command, log, file or chat output.
