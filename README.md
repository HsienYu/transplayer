# Transplayer — Elephants and Stones

A transparent, click-through video overlay spanning two portrait displays,
with the original Selenium browser choreography driven by video timecodes.

## Ubuntu 18.04 portable edition

This repository integrates the more complete installation source rather than
the older Electron 6 repository snapshot. Original media and installation
directories are not modified. This is a compatibility release, not a security
upgrade of the legacy browser engine.

The Linux x64 AppImage bundles Electron 9.3.2 (Node 12.14.1), Chrome
87.0.4280.88, matching ChromeDriver, Selenium 4.0.0-alpha.7, OSC 2.1.0 and
the original browser extension. No system Node, npm or PM2 is required.
The unpacked `.AppDir/AppRun` is the fallback entry point.

### Display and playback

- Two 1080×1920 monitors side by side form a **2160×1920** canvas.
- The app checks the desktop dimensions instead of silently stretching to
  the wrong monitor layout. Use GNOME's Display settings to save the layout.
- First playback begins at **775 seconds**. The 780-second video then loops
  from zero, preserving the original behavior and `object-fit: fill`.
- Ubuntu Dock and the top bar are hidden only during playback. Their prior
  visibility is restored on stop and on loss of the main process's IPC
  connection. This uses the verified **GNOME Shell 3.28 / Ubuntu Dock 63**
  API, not a permanent preference change. Other GNOME versions need testing.
- Stop with **Ctrl+Alt+Q**, the **Stop Transplayer** desktop shortcut, or
  the same AppImage with `--stop`.

### Live search and CAPTCHA

Live Google image search is intentionally retained. `web-process-new.js`
is the active timeline; its search terms, event times and browser positions
are unchanged. This release does not substitute offline pages, cached search
results, a search API or prerecorded browser footage.

Google can show CAPTCHA for automated searches. This remains an operational
limitation: packaging does not prevent it, and no CAPTCHA bypass or automatic
challenge detection/pause has been implemented. On-site intervention may be
needed. Ctrl+Alt+Q stops the whole installation; restarting begins at 775
seconds rather than resuming the last video position.

### Install and run

Keep the AppImage, its SHA-256 sidecar, and the external video. Make the
AppImage executable, verify its checksum, then run:

```sh
python3 packaging/install-desktop.py \
  --appimage /absolute/path/Transplayer-ubuntu18-x86_64-r4.AppImage \
  --video /absolute/path/stonesandelephants.webm
```

The installer refuses to overwrite an existing desktop shortcut or a
different configuration. It creates Start/Stop shortcuts and
`~/.config/transplayer/config.json`. No auto-start service is installed.

Configuration fields:

- `videoPath`: local video path; relative paths resolve against the config
  file directory, not the working directory.
- `startSeconds`: nonnegative start position (default 775).
- `expectedWidth`, `expectedHeight`: expected desktop union (2160, 1920).

`config.example.json` is an example for a configuration placed beside the
release directory layout; adjust its relative media path when moving it.
Set `TRANSPLAYER_CONFIG` to use a different JSON file.
Browser profiles are app-owned under `~/.local/share/transplayer/profiles`,
not the user's personal Chrome profile.

### Requirements and limitations

Verified baseline: Ubuntu 18.04.5 x86_64, glibc 2.27, X11, GNOME Shell 3.28.4,
Ubuntu Dock 63, GTK3/NSS/ALSA/GBM/XSS shared libraries and working GPU drivers.
The launcher uses the kernel's user-namespace sandbox, not `--no-sandbox`;
unprivileged user namespaces must be enabled. The static AppImage runtime
still does not replace the host kernel, graphics drivers or system libraries.

These old Electron and Chrome releases have unpatched vulnerabilities.
Use a dedicated installation account without credentials or personal
browser profiles. Packaging freezes dependencies, not external website
content: Google search layout, availability and network behavior can change.
Modernizing the OS and browser is a separate migration requiring visual
regression testing of the artwork.

## Build and archive

On the legacy Linux machine, assemble from the verified installation:

```sh
python3 packaging/build-portable.py \
  --legacy /path/to/original/transplayer-master \
  --chrome /opt/google/chrome \
  --output /path/to/releases/new-release.AppDir
python3 packaging/build-appimage.py \
  --tool /path/to/verified/appimagetool.AppImage \
  --appdir /path/to/releases/new-release.AppDir \
  --output /path/to/releases/Transplayer-new-release.AppImage
```

The assembler verifies runtime versions against `package-lock.json`, copies
only locked non-dev modules, creates `VERSIONS.json` and `SHA256SUMS`, and
refuses to overwrite a previous release. The AppImage wrapper verifies the
tool against `packaging/toolchain.json` and reuses that verified tool's
runtime instead of fetching a mutable latest runtime.

Archive the finished AppImage, SHA-256 file, original video, exact source,
lockfile, build tool and unpacked AppDir. The tool's continuous URL can
change; a checksum mismatch must fail rather than silently update it.
Building from the historical install is deliberate: a clean online
`npm ci` rebuild has not been verified, and cannot be promised indefinitely.
The supplied binaries are intended for this private installation; review
Chrome and extension redistribution terms before publishing them.

## Optional PM2 startup

`ecosystem.config.js` manages the **unpacked r4 AppDir/AppRun** from the same
release. This makes PM2's signals reach Electron directly instead of an
AppImage mount helper. Keep that AppDir installed while this PM2 config is
in use. Override `TRANSPLAYER_EXECUTABLE` before loading the config when
deploying a new unpacked release.

`packaging/pm2-launch.sh` waits for authenticated X11 and the user's GNOME
Shell before executing the player. The config sets DISPLAY, XAUTHORITY,
XDG_RUNTIME_DIR and the session bus for the installation account. It runs
one instance, delays crash restarts, and gives the app 20 seconds to stop
its own children and restore the desktop. Normal exit (including the Stop
shortcut) does not restart; use `pm2 restart transplayer` to resume.

On the target Ubuntu account, load the already installed nvm runtime:

```sh
export PATH="$HOME/.nvm/versions/node/v16.20.2/bin:$PATH"
pm2 start "$HOME/Documents/transplayer-portable-source/ecosystem.config.js" --only transplayer
pm2 save
pm2 startup
```

Run the privileged startup command printed by `pm2 startup` exactly as
instructed by PM2; manage the app itself as the desktop user, **not root**.
Stop any manually started Transplayer before starting its PM2 instance.
Check `pm2 logs transplayer --lines 50 --nostream` and `pm2 status`.
After changing saved configuration, reload with `--update-env` and save again.

**PM2 startup does not log into GNOME.** Unattended playback additionally
requires desktop auto-login and a saved 2160×1920 display layout. Neither
auto-login nor persistent rotation is configured here. Before login the
PM2 process may show online while its launcher is still waiting; this is
not proof that video is playing. Reboot behavior still needs a real test.

The configuration and wrapper were added without running `pm2 startup`,
`pm2 save` or installing a system service.
## Development and verification

Run `npm test` with Node 18+ on the development machine. Production code
remains compatible with bundled Node 12.14.1. No test dependency is needed.
See `tests/README.md` for Linux integration probes and
`tests/manual/portable.md` for visual, click-through and soak verification.

Known verification scope: short real-desktop playback and wraparound,
synthetic real-Chrome scrolling, port release, desktop hiding and
parent-disconnect restoration. A full 780-second cycle, audio, physical
seam alignment, click-through and a representative long soak still require
on-site acceptance. Do not label a short smoke test exhibition-ready.

The repository contains source and packaging scripts, not the original
3.12 GB video, Chrome/ChromeDriver binaries, browser extension, browser
profiles or release artifacts. The portable builder takes the required
external assets from the verified legacy installation. `npm start` alone
is therefore not a complete fresh-machine deployment; use the packaged
release or follow the build instructions.

Unused old timeline and Windows-only focus helpers have been removed, along
with obsolete electron-packager commands. The current timeline and Linux
runtime entry points remain. Source cleanup does not modify the already
deployed r4 artifact; rebuild into a new release directory to deploy later
source changes.

## Recovery

Use `--stop` or Ctrl+Alt+Q first. These stop only the app's owned browser
sessions and restore the desktop. Do not broadly kill Chrome or GNOME.
If both the player and its independent desktop guard are forcibly killed,
logging out and back in resets the transient Shell actor state; ordinary
player crashes are handled by the guard.

Previous releases remain separate. Stop the current release before starting
a previous verified one with the same external configuration. The original
source directory remains intact, but is not claimed as a verified fallback.
No login autostart or permanent display rotation is configured by the app.
