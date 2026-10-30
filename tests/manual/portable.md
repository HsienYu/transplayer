# Portable desktop verification

## Scope and safety

This run installs a new version directory only. The original source and video
remain untouched. Do not alter desktop rotation, existing browser sessions,
system packages, or login startup. User approval for this run was given in
the task conversation.

## Before starting

1. `DISPLAY=:0 xrandr --listmonitors`: expect 2 monitors, each 1080×1920,
   with union 2160×1920. Stop the exhibition launch on mismatch.
2. Verify exactly one readable video path in the external JSON configuration.
   Expected original file size: 3115894718 bytes. Hash it for the release
   record before and after verification; never modify the file.
3. Confirm no listener on localhost:8080 and no existing instance of this
   release. If occupied, stop; do not kill an unknown process.
4. Check runtime versions: Electron 9.3.2, Node 12.14.1, Chrome and ChromeDriver
   87.0.4280.88. Verify release checksums and missing shared libraries.

## Bounded validation

1. Test the bundled controller against a local synthetic page: browser
   launch, requested rectangle, positive scroll offset, quit and zero
   remaining owned driver processes. Do not use a personal Chrome profile.
2. Launch the overlay for a bounded interval. Expect one borderless,
   nonfocusable, click-through window spanning both screens.
3. Confirm metadata loads, initial position is 775 seconds, time advances,
   no media error occurs, and frame counters increase. Record dropped frames.
4. Visually check the actual desktop is visible through transparent video
   areas, the seam is continuous, and mouse clicks reach the underlying
   window. A renderer screenshot alone does not verify OS click-through.
5. Observe browser actions at the matching timecodes, including scrolling.
   External websites may have changed since 2020; report any failures.
6. Stop through the app control. Expect zero owned child/browser processes,
   no listener on 8080, and the unrelated desktop unchanged.
7. Verify top bar and all Ubuntu Dock actors are hidden while playing and
   restored to their prior visibility after stop. Run the separate
   `desktop-smoke.js` probe to verify restoration on parent IPC disconnection.
   This mechanism targets GNOME 3.28; it does not claim support on newer GNOME.

For port checks, use `ss -ltn` or a Node `net.Server` bind. A raw Python socket
without `SO_REUSEADDR` can fail on a closed connection's TIME_WAIT even when
no listener exists; do not misreport that as a leaked controller.

## Full exhibition verification (requires user observation)

Run at least one complete loop, then agree a representative soak duration.
Check first start at 775 seconds, subsequent loop from zero, browser cleanup
at the prescribed timecodes, audio, GPU/CPU load, memory growth and recovery.
Record actual measured results, not assumed thresholds.

## Rollback

Stop only this release through its stop entry. Do not delete the original
directory. Launch the previously verified release if one exists; otherwise
leave the app stopped. Do not call the original source a verified fallback
until it has passed its own playback check.

## Evidence

Pending. Store complete command/test output in the ignored `evidence/`
directory and report relevant paths and results in the task conversation.
