#!/usr/bin/env python3
"""Install new per-user configuration and desktop shortcuts without overwriting files."""
import argparse
import json
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
entrypoint = parser.add_mutually_exclusive_group(required=True)
entrypoint.add_argument("--appimage", type=Path, help="Historical portable AppImage")
entrypoint.add_argument("--executable", type=Path, help="Verified versioned AppDir/AppRun")
parser.add_argument("--video", required=True, type=Path)
args = parser.parse_args()
image = (args.executable or args.appimage).resolve(strict=True)
video = args.video.resolve(strict=True)
if not image.is_file() or not video.is_file():
    raise SystemExit("AppImage and video must be files")
if args.executable and not os.access(image, os.X_OK):
    raise SystemExit("AppDir entrypoint must be executable")
home = Path.home()
configdir = home / ".config/transplayer"
config = configdir / "config.json"
desktop = Path(subprocess.check_output(["xdg-user-dir", "DESKTOP"]).decode().strip())
entries = [desktop / "Transplayer.desktop", desktop / "Stop-Transplayer.desktop"]
if any(entry.exists() for entry in entries):
    raise SystemExit("Desktop entries already exist; refusing to overwrite")
expected = {"videoPath": str(video), "startSeconds": 775,
            "expectedWidth": 2160, "expectedHeight": 1920}
if config.exists() and json.loads(config.read_text(encoding="utf-8")) != expected:
    raise SystemExit("An existing config differs; review it before installing")
configdir.mkdir(parents=True, exist_ok=True)
if not config.exists():
    with config.open("x", encoding="utf-8") as stream:
        json.dump(expected, stream, indent=2)
    config.chmod(0o600)

def desktop_quote(value):
    # Desktop Exec syntax is not shell syntax. Escape reserved characters and field codes.
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"').replace(
        "`", "\\`").replace("$", "\\$").replace("%", "%%") + '"'

for entry, name, option in [(entries[0], "Transplayer", ""), (entries[1], "Stop Transplayer", " --stop")]:
    with entry.open("x", encoding="utf-8") as stream:
        stream.write("[Desktop Entry]\nType=Application\nName={}\nExec={}{}\nIcon=video-x-generic\nTerminal=false\nCategories=AudioVideo;\n".format(
            name, desktop_quote(image), option))
    entry.chmod(0o755)
    env = os.environ.copy()
    env.setdefault("DBUS_SESSION_BUS_ADDRESS", "unix:path=/run/user/{}/bus".format(os.getuid()))
    result = subprocess.run(["gio", "set", "-t", "string", str(entry), "metadata::trusted", "true"],
                            env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode:
        print("Launcher needs manual Trust and Launch:", entry.name)
        print(result.stdout.decode("utf-8", errors="replace"))
print("DESKTOP_INSTALLED", len(entries))
