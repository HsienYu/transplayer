# DuckDuckGo and native Dock r6 deployment and rollback
Historical protocol retained for the r6 artifact and rollback investigation.
The user subsequently chose Google with modern Chrome/Driver; use
`google-r7.md` for the current migration. Do not deploy r6 from these steps
as if it were the latest requested version.

User approval covers replacing the search engine and briefly stopping the
current installation for a versioned switch. Do not install extensions,
solve CAPTCHA automatically, upgrade runtimes, alter systemd, or archive
old releases during this run. Stop at the first unexpected result.

## Baseline and build

1. Expect exactly one PM2 entry named `transplayer`, currently targeting
   `portable-r4.AppDir/AppRun` through the old staging source's launcher.
   Record only selected status/path fields, never the full environment.
2. Expect two 1080x1920 monitors forming 2160x1920, external video size
   3115894718 bytes and the r4 AppImage SHA-256
   `8a6a4528a8fcce8a2eadeab672e7e1c802f9e1e105a2549c2f1aef6a1edc3947`.
3. Expect zero existing `transplayer-source-r6`, `portable-r6.AppDir` or
   r6 AppImage destinations. Transfer source into the new source directory.
   Do not overwrite `transplayer-master` or `transplayer-portable-source`.
4. Run the existing Python offline builders from the new source. Use the
   legacy node_modules, `/opt/google/chrome`, and retained pinned tool
   `tools/appimagetool-b082d2ec-x86_64.AppImage`. Expect zero version/checksum
   mismatches. Validate every AppDir manifest entry and the AppImage sidecar.
5. Require all Node tests, JS/Python/Shell syntax checks, diff checks and a
   redacted secret scan to pass. Record all output under ignored `evidence/`.

## Backup and switch

1. Create a new private backup directory (0700) under remote release evidence.
   Copy the two desktop launchers, external config and any existing PM2
   dump/dump backup there (0600). These files remain remote; never print their
   contents or include them in the repository. Record file hashes only.
2. Record the current PM2 PID and its `/proc` start time. Use
   `pm2 stop transplayer` for graceful shutdown. Expect that exact process
   to exit, zero r4-owned processes, no listener on 8080 and restored GNOME
   panel/Dock state. Abort the switch if any condition is not satisfied.
3. Start/reload only `transplayer` using the new ecosystem config and r6
   AppRun. Expect exactly one online entry, new source launcher/cwd, and r6
   executable arguments. Confirm advancing video timestamps and one 8080
   listener before saving PM2 state.
   On this host, `startOrRestart --update-env` retained the old script/cwd.
   After a verified graceful stop, use `pm2 delete transplayer` to remove
   only the stopped process definition, then `pm2 start` with the new
   ecosystem file and `--only transplayer`. Recheck all three paths.
   The host's `ss` crashed during inspection; use `/proc/net/tcp{,6}`
   listener state `0A` and port `1F90` instead, checking command exit codes.
4. Prepare new desktop launcher files beside the old entries and atomically
   replace each only after validating its sole Exec target. Preserve
   executable permissions and set `metadata::trusted` with `gio`.
   Expect exactly two launchers pointing to r6 (Stop includes `--stop`).
5. Save PM2 state. Recheck r4's checksum and the original video metadata;
   neither old release nor media may have changed.

## Live verification

Before starting the new installation, run `dock-smoke.js` as Electron:
expect native Dock shown with only the transparent overlay, hidden with
its synthetic Chrome window covering the Dock, and shown after Chrome
closes. Expect restored panel/hook after normal stop. Then run
`desktop-smoke.js` with `ELECTRON_RUN_AS_NODE=1` to test parent-disconnect
restoration. The existing native autohide/intellihide settings must remain
unchanged. An unrelated overlapping window is a failed precondition, not
permission to close it.

Observe existing WebDriver sessions without navigating them or injecting
scroll commands. Record only query terms from this artwork, host, date-filter
parameters, geometry, scroll offsets, image counts and challenge booleans;
do not retain arbitrary page text, cookies or session credentials.

Expect DuckDuckGo image pages, positive scroll deltas when content exceeds
the viewport, and image date filters corresponding to Day/Year for the two
original restricted queries. The remaining 11 queries have no date filter.
Sample frequently enough to cover all 13 search events and both branches
of the 775-second event. A no-results/short page need not scroll; distinguish
it from an error, CAPTCHA, a missing event, or a broken scroll target.

Monitor approximately 800 seconds from startup, covering initial 775-to-0
wraparound plus a complete 780-second cycle. Require advancing playback,
expected event queries, stable PM2 PID/restart count and no leaked owned
browser sessions. Record errors and failed acceptance criteria verbatim.
Do not label a single cycle a soak test or proof against future blocking.
Keep the intended PM2 playback running after a successful deployment.

## Rollback

1. Stop r6 through `pm2 stop transplayer`; verify its PID has exited and
   8080 has no listener before continuing.
2. Set `TRANSPLAYER_EXECUTABLE` to the preserved r4 AppRun and start/reload
   the unchanged `transplayer-portable-source/ecosystem.config.js`.
   Expect the original launcher/cwd/r4 arguments and advancing playback.
   When changing source paths, remove only the verified stopped PM2
   definition and start the old ecosystem file, rather than relying on
   restart to replace script/cwd.
3. Restore the two backed-up desktop launchers using temporary sibling
   files and atomic replacement, restore executable mode/trusted metadata,
   and run `pm2 save`. Never blindly replace a running PM2 daemon's dump.
4. Keep the r6 source/build/evidence for investigation; do not delete or
   overwrite releases or media. If recovery cannot be verified, report the
   exact failed step and leave the installation safely stopped.

## Evidence

Execution results are recorded in ignored evidence and the native task plan.
This runbook specifies acceptance criteria; it does not assert they passed.
