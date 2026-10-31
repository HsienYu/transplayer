# Ubuntu 26.04 installation acceptance

Status: **NOT EXECUTED — hardware verification deferred by the user**.
Target: Ubuntu 26.04 LTS amd64, GNOME 50 / Ubuntu Dock, two portrait
1080×1920 displays. Existing Ubuntu 25.10 r9 exhibition is out of scope.

## Before testing
Use a disposable new test installation with the user's maintenance approval.
Keep the installer, checksum, full logs and previous package for recovery.
Do not use personal browser profiles or credentials. Record actual UTC
timestamps and hardware; never copy historical r9 results into this report.

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
5. Opt in to autostart, perform a coordinated reboot, and witness playback
   without stale desktop authentication or keyring prompt. Repeat with
   autostart off. Do not change GDM or keyring automatically.
   Also repeat startup from an unclean exhibition-profile shutdown in an
   approved test window: require no restore bubble after login and real
   playback progress. Do not pull power on a production installation merely
   to exercise this case; record the exact simulated failure and do not call
   it a physical power-loss test.

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
Every step is pending until executed with full output and actual observations.
Archive failures, cancellations and rollback evidence as well as successes.
Release remains RC / awaiting Ubuntu 26.04 hardware verification.
