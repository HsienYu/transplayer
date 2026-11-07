# Verification

Run the portable test suite on the development machine with Node 18+ and
Python 3.10+. No test package is installed; the Node runner is built in and
the Python tests use only the standard library.

```sh
npm test                        # node --test tests/*.test.js
python3 tests/installer_cases.py
```

Target platform: Ubuntu 26.04 LTS amd64 / GNOME 50. The application retains
Electron 45.1.0 / embedded Node 24.22.1; the separate supervisor uses
Node 24.22.2 / PM2 7.1.1. The pure modules keep Node 12-compatible syntax
for the historical installation path that `main.js` can still select.

## Current status

The portable suite passes **132 Node tests, 0 failures, 0 skipped**, and
`installer_cases.py` passes **52 Python tests (OK)**. One of the 132 Node
tests (`installer.test.js`) is a wrapper that executes the Python suite, so
132 and 52 are not additive.

These are portable unit tests. They do **not** launch real Chrome, GTK, PM2,
apt/dpkg, AppArmor, GNOME, audio or a physical display, and they do not prove
video transparency, click-through, monitor orientation, website availability,
GPU performance or exhibition readiness. New logic needs happy, edge and error
cases plus hostile trust-boundary inputs; GTK/PM2/browser objects are mocked.

Real-hardware acceptance is the
[Ubuntu 26.04 installation protocol](manual/ubuntu26-installation.md). The
deployed `1.1.0~rc8` has been installed and reboot-verified on the reference
host (MSI MS-7D17); the full acceptance gates in that protocol — long soak,
licence/vulnerability/lintian audit, upgrade/removal/failure-recovery — remain
open. Unit tests are not evidence of accepted production behaviour.

## What each suite covers

- `timeline.test.js` — the real timeline with a recording controller: all 13
  search terms, image/date URL parameters, 19 event times, rectangles, scroll
  distances, the 775 s start and repeat loop, idle seconds and shutdown.
- `controller.test.js` — awaited WebDriver session cleanup, every timeline
  operation remaining available, the `/sorry/` abuse-gate retry and the
  same-day snapshot cache logic (serve cached MHTML on a gated page, capture
  once on first-clean), and the operator solver opt-out.
- `chrome-session.test.js` — Chrome-first launch and replacement, private
  temporary profile preparation (translation/password/autofill/notification/
  location/camera prompts off), exact loopback debugger URL and `/proc`
  socket-inode ownership, dead/foreign/malformed lock handling, the
  `--hide-crash-restore-bubble` / `--disable-infobars` /
  `--disable-blink-features=AutomationControlled` flags without security-bypass
  switches, snapshot-capture (MHTML) plumbing, and the
  `TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION` gate.
- `browser-toolchain.test.js` — Python-driven checks of exact browser archive
  hashes, missing inputs, version mismatches and hostile ZIP paths/symlinks.
- `main.test.js` — the production entrypoint in a VM with synthetic Electron/
  process/child boundaries and real canvas geometry: default GPU policy without
  bypass flags, transparent click-through placement, renderer isolation,
  hostile navigation / wrong-display refusal, cooperative/idempotent stop and
  duplicate-instance refusal.
- `desktop.test.js` — the legacy GNOME guard (`desktop-guard.js`, still
  selectable by `main.js`): top-bar hiding, native Dock visibility, player-PID
  exclusion, snapshot ownership and partial-failure rollback/restoration.
- `desktop-modern.test.js` — the GNOME 50 restricted desktop lease
  (`desktop-modern-guard.js` + the shipped extension lease module): lease
  acquisition, hostile PID/UID/ancestry/executable inputs, duplicate/foreign
  ownership, caller disconnect, extension-disable and the exact single-title
  Linux command line (lookalike paths/flags rejected).
- `install-desktop.test.js` — the Python desktop installer with a synthetic
  HOME and stubs: AppDir launchers, path quoting, config permissions, overwrite
  refusal and invalid entrypoints.
- `pm2.test.js` — the fixed-root entrypoint and PM2 single-instance / shutdown
  policy with synthetic X11/GNOME/D-Bus stubs, bounded login readiness,
  check-only mode, stale extension revisions and the crash-recovery policy
  (`stop_exit_codes`).
- `pm2-session.test.js` — the current-login wrapper with isolated PM2 stubs:
  fresh credentials, no duplicate online start, replacing only one stopped
  definition, refusal of foreign/errored state or missing Xauthority, scoped
  stop and unsupported actions.
- `portable.test.js` — external UTF-8 config and the 2160×1920 display union,
  negative coordinates, invalid input and hostile OSC values.
- `installer.test.js` — a thin Node wrapper that runs `installer_cases.py`.
- `installer_cases.py` (52 tests, also runnable directly) — private/idempotent
  settings, explicit replacement/backup, foreign/legacy state, symlink and
  command-injection inputs, write rollback, real cross-process account-lock
  blocking, safe diagnostic export, GDK init/probe isolation, monitor geometry
  and direction-only layout planning (malformed/mirrored/gapped/offset
  rejection), input manifests, safe Node archive extraction, Linux supervisor
  input preparation (darwin-only optional omission), and mocked maintenance
  configure failure/retry plus process-scan refusal.

Fixtures use standard-library temporary directories; no real media, personal
browser data or credentials. See [development](../docs/development.md) and
[operations](../docs/operations.md) for build provenance, release blockers and
maintenance boundaries.
