# Google and modern Chrome r7 deployment gate

This is an approved versioned candidate, not proof that CAPTCHA is solved.
The first r7 AppImage build failed the permission check because upstream
`deb.deps` and `rpm.deps` were mode 0600. A regression test reproduces it;
the corrected extractor ensures public bundle files are world-readable
without setuid/setgid bits. The new artifact/source suffix is **r7b**;
all candidate deployment steps below refer to r7b, preserving failed r7.
Preserve the original source/video, r4 and r6; do not upgrade the OS, glibc,
Electron or Selenium, change systemd, or archive releases during this run.

## Compatibility and build

1. Expect Chrome and ChromeDriver 156.0.8078.80, both version checks exiting
   zero. Verify all three official archive hashes against the tracked lock.
2. With an isolated profile, expect a 200 px synthetic scroll, requested
   800x1000 rectangle, and one ENABLED NopeCHA v0.6.1 without extension
   load errors. Quit the session and expect zero profile-owned processes.
   Chrome registry uses version_name `v0.6.1`; manifest version is `0.6.1`.
3. Google must actually load image results and scroll to pass live search
   acceptance. Four samples remaining on `/sorry/index` are a failed gate,
   not a reason to assume the extension worked.
4. Full tests, syntax checks and secret/diff review must pass. Record complete
   output, including failures. Build only into new source-r7/AppDir/AppImage
   destinations; verify all manifest entries and the AppImage sidecar.
5. Use a new r7 profile namespace, not existing Chrome87 profiles. Never
   load the old Manifest V2 uBlock into modern Chrome; this candidate uses
   only the pinned Manifest V3 solver, which changes ad-blocking behavior.
   Free service only; no account, paid credits, private profile or proxy.

## Production transition (known CAPTCHA limitation accepted)

The user subsequently explicitly accepted that CAPTCHA can still appear
and authorized production promotion. This lifts only the external-search
success gate, not the checks for backups, integrity, process cleanup,
desktop restoration, correct paths and advancing video.
The latest connection attempt timed out and Tailscale reported the target
offline; promotion remains unexecuted for that reason. Re-establish a fresh
baseline once connected, never reuse the old PID as a destructive target.
Record challenge pages as failed search behavior, not a passed Google test.

1. Expect exactly one PM2 transplayer entry, r6 script/cwd/AppRun and stable
   restart count. Create a private 0700 backup with 0600 copies of both
   launchers, config and PM2 dump files; never print their environment.
2. Gracefully stop that exact process. Require exited PID, no r6-owned
   browser/controller processes, zero 8080 listeners and restored GNOME.
   Inspect `/proc/net/tcp{,6}` (state 0A, port 1F90); host `ss` has crashed.
3. Remove only the verified stopped PM2 definition, then start r7 ecosystem
   with `--only transplayer`; restart retained stale script/cwd previously.
   Require one online item and exact r7 script/cwd/args, advancing video,
   and one 8080 listener.
4. Atomically replace both backed-up launcher targets with r7 AppImage
   (Stop includes --stop); preserve executable mode and trusted metadata.
   Save PM2 only after those checks pass. Do not replace its live dump.
5. Observe startup 775-to-0 plus a complete 780-second cycle, logging only
   artwork queries, host/path category, date filters, geometry, scroll,
   image counts, challenge flags, video progress and PID/restarts.
   No cookies, arbitrary page text or session IDs in evidence.
   A complete cycle is not a soak or reboot/audio/physical-seam acceptance.

## Rollback

Stop r7 normally and require its PID exit, released port and restored desktop.
Recreate only the stopped PM2 item from the backed-up prior source/AppRun
definition, verifying script/cwd/args and advancing playback. Restore both
launchers by atomic sibling-file replacement, set trusted metadata and save
PM2. Keep all releases and evidence. If recovery fails, leave safely stopped
and report the precise failure. Do not silently choose an untested fallback.

## Actual evidence

Initial modern-browser gate passed synthetic scrolling and extension
activation using existing Electron9/Node12/Selenium alpha7. Initial test had
an assertion mismatch on `v0.6.1` versus `0.6.1`; corrected test passed.
Google then stayed at `/sorry/index` for four samples over 40 seconds,
with zero images and zero scroll range. Production promotion is blocked.
Logs: `evidence/r7-browser-compatibility.log` and
`evidence/r7-browser-compatibility-v2.log`. No full Google cycle has passed.

Corrected r7b build passed: 41 source hashes, 721 AppDir manifest entries,
AppImage SHA-256
`c4a189d6a63546aa2f364ef9e10df1a3a995c1c935baff9217db55a91e1041fa`.
Full suite: 39 passed, 0 failed, 0 skipped (`evidence/r7b-full-green.log`).
Packaged controller smoke scrolled 400 px and quit successfully
(`evidence/r7b-packaged-browser-smoke.log`).
Packaged extension registry confirmed ENABLED v0.6.1 with 0 errors, but
six Google samples over 60 seconds all had sorry=true, recaptcha=true,
0 images and 0 scroll range (`evidence/r7b-packaged-google-probe.log`).
No production switch, launcher update or PM2 save was performed.
Final check found zero r7 test-profile processes and unchanged r6 PM2
PID/restarts. r4 and r6 AppImage hashes remain intact.
