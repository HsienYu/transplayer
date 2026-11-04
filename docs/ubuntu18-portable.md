# Ubuntu 18.04 Portable (r7b) -- Installation and Operation

## Overview / 概要

This document covers the **r7b portable** deployment for Ubuntu 18.04.5 LTS
(glibc 2.27). It uses Electron 9.3.2 with Chrome-for-Testing 156 and the
NopeCHA 0.6.1 extension. The r7b line is separate from the r10 installer-based
line (Ubuntu 26, Electron 45); they share the controller and choreography code
but have different runtimes, packaging and deployment paths.

## Known Limitations / 已知限制

- **No GPU + transparency together.** Electron 9 cannot do GPU compositing
  with a transparent window. `app.disableHardwareAcceleration()` is required
  for transparency; removing it enables GPU but loses the see-through overlay.
  Modern Electron (v15+) can do both, but needs glibc >= 2.31 (Ubuntu 20.04+).
  Dropped frames from software rendering are expected on this platform.
- **Google reCAPTCHA.** Automated Chrome (chromedriver) triggers Google's
  bot detection. Mitigated by `--disable-blink-features=AutomationControlled`
  and `excludeSwitches(["enable-automation"])`. If reCAPTCHA reappears, clear
  the scene profiles (`~/.local/share/transplayer/profiles-r7/se_*`) and
  restart. NopeCHA is loaded as a fallback solver.

## Requirements / 準備項目

- Ubuntu **18.04 LTS amd64**, kernel 5.4+, desktop session (GNOME/GDM).
- NVIDIA GPU with proprietary driver (nouveau cannot drive Ampere/Ada on
  kernel 5.4). Tested: RTX 3050 with nvidia-driver-525 via
  `ppa:graphics-drivers/ppa`. Secure Boot must be **OFF** for DKMS.
- Two 1080x1920 portrait displays, side-by-side = 2160x1920 canvas.
- Node.js v16 (via nvm); PM2 7.x for process management.
- The artwork video `stonesandelephants.webm` (2160x1920, 780s) placed
  in a stable local path.

## Installation Steps / 安裝步驟

### 1. NVIDIA driver

```sh
sudo add-apt-repository -y ppa:graphics-drivers/ppa
sudo apt-get update
sudo apt-get install -y nvidia-driver-525 dkms build-essential
sudo reboot
# verify:
nvidia-smi            # should list the GPU
lsmod | grep nvidia   # nvidia loaded, not nouveau
```

### 2. Display rotation (portrait)

Create `~/.config/autostart/transplayer-display.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Transplayer Display Rotation
Exec=/home/<user>/.config/transplayer-display.sh
X-GNOME-Autostart-enabled=true
X-GNOME-Autostart-Phase=Initialization
NoDisplay=true
```

Create `~/.config/transplayer-display.sh` (chmod +x):

```sh
#!/bin/sh
for i in $(seq 1 30); do xrandr >/dev/null 2>&1 && break; sleep 1; done
xrandr --output DP-1 --mode 1920x1080 --rotate left --pos 0x0 --primary \
       --output HDMI-0 --mode 1920x1080 --rotate right --pos 1080x0 || true
```

Adjust output names (`DP-1`, `HDMI-0`) and rotation direction (`left`/`right`)
to match your physical mount. Verify with `xrandr` after login.

### 3. Node.js and PM2

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 16
npm install -g pm2
```

### 4. Deploy the AppDir

Place `portable-r7b.AppDir/` under `~/Documents/transplayer-releases/`.
The AppDir contains the Electron runtime, Chrome-for-Testing, chromedriver,
the NopeCHA extension, and the application code.

### 5. Transplayer config

Create `~/.config/transplayer/config.json`:

```json
{
  "videoPath": "/home/<user>/Documents/transplayer-master/video/stonesandelephants.webm",
  "startSeconds": 775,
  "expectedWidth": 2160,
  "expectedHeight": 1920
}
```

### 6. PM2 ecosystem and autostart

Create `ecosystem.config.js` or register via PM2 directly. The launch script
(`pm2-launch.sh`) waits for the GNOME desktop before starting the AppRun.

Key environment variables for PM2:

| Variable | Value |
|---|---|
| `DISPLAY` | `:0` |
| `XAUTHORITY` | `/run/user/1000/gdm/Xauthority` |
| `DBUS_SESSION_BUS_ADDRESS` | `unix:path=/run/user/1000/bus` |
| `TRANSPLAYER_EXECUTABLE` | path to `portable-r7b.AppDir/AppRun` |
| `TRANSPLAYER_CONFIG` | `~/.config/transplayer/config.json` |
| `TRANSPLAYER_NONINTERACTIVE` | `1` |

```sh
pm2 save
pm2 startup   # generates the systemd unit (pm2-<user>.service)
sudo env PATH=$PATH:/home/<user>/.nvm/versions/node/v16.20.2/bin \
  pm2 startup systemd -u <user> --hp /home/<user>
```

### 7. Reboot and verify

```sh
sudo reboot
# After login, verify:
pm2 list                     # transplayer = online
pm2 logs transplayer --lines 10  # DISPLAY count:2, PLAYBACK playing
```

## Operations / 日常操作

| Action | Command |
|---|---|
| View status | `pm2 list` |
| View logs | `pm2 logs transplayer --lines 50` |
| Restart player | `pm2 restart transplayer` |
| Stop player | `pm2 stop transplayer` |
| Clear scene profiles (reCAPTCHA fix) | `pm2 stop transplayer && rm -rf ~/.local/share/transplayer/profiles-r7/se_* && pm2 start transplayer` |

## Rollback / 復原

The previous r4 AppDir is kept alongside r7b. To roll back:

```sh
pm2 stop transplayer
# edit PM2 dump or ecosystem to point at portable-r4.AppDir/AppRun
pm2 start transplayer
pm2 save
```

## Formal Host Record / 正式機紀錄

| Field | Value |
|---|---|
| Host | hsu-ms-7d17 (Tailscale `100.111.176.2`) |
| Hardware | i5-11500 (12 threads), 16 GB RAM, NVIDIA RTX 3050 (ZOTAC) |
| OS | Ubuntu 18.04.5 LTS, kernel 5.4.0-144 |
| Driver | nvidia-driver-525 (PPA, DKMS, Secure Boot OFF) |
| Displays | DP-1 left + HDMI-0 right = 2160x1920 portrait |
| Player | portable-r7b.AppDir, Electron 9.3.2, Chrome 156 |
| Autostart | pm2-hsu.service (enabled) + display rotation desktop entry |
| Video | `/home/hsu/Documents/transplayer-master/video/stonesandelephants.webm` |
| Deployment date | 2026-11-04 |
