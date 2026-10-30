# Verification

Run `node --test tests/*.test.js` with Node 18 or newer on the development
machine. The test runner is built in; no test package is installed.
Production modules must remain compatible with the bundled Node 12.14.1.

`portable.test.js` covers the agreed 2160×1920 display union, negative
coordinates, external UTF-8 media configuration, invalid input, and hostile
OSC values. Fixtures are synthetic temporary files removed by each test.

`controller.test.js` verifies awaited WebDriver session cleanup and that
every controller operation referenced by the live timeline remains available.
`desktop.test.js` uses synthetic GNOME actors to test hiding, auto-show
suppression, snapshot ownership, partial-failure rollback and restoration.
`pm2.test.js` checks PM2 single-instance/shutdown policy and uses synthetic
X11, D-Bus and sleep commands to verify waiting, check-only mode, missing
executables and paths containing spaces without starting a real player.

Linux integration probes run with the bundled Electron, not a system Node:
`browser-smoke.js` (synthetic real Chrome page), `bridge-smoke.js`
(readiness and port release), `desktop-smoke.js` (real GNOME parent-disconnect
recovery), and `media-smoke.js` (muted hidden real-video decode).
Set `TRANSPLAYER_APP_ROOT` to the bundle's `app` directory; browser probes
also need `TRANSPLAYER_CHROME` and `TRANSPLAYER_DRIVER`. The media probe needs
`TRANSPLAYER_VIDEO` and is run as Electron, without `ELECTRON_RUN_AS_NODE`.

Historical root-level browser experiment scripts are not part of this
repository or the automated suite.

See `manual/portable.md` for the required real-desktop protocol. Automated
tests cannot establish video transparency, physical monitor orientation,
website availability, or exhibition readiness.
