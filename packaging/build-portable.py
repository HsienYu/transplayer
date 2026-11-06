#!/usr/bin/env python3
"""Assemble an offline, checksummed Linux bundle from a verified legacy install."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import zipfile
import zlib
import tempfile
from browser_bundle import prepare_browser

parser = argparse.ArgumentParser()
parser.add_argument("--legacy", required=True, type=Path)
parser.add_argument("--browser-archives", required=True, type=Path,
                    help="Directory containing the three checksum-locked browser/extension archives")
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
source = Path(__file__).resolve().parents[1]
legacy = args.legacy.resolve()
output = args.output.resolve()
if output.exists():
    raise SystemExit("Output already exists; use a new version directory")
expected = {
    "electron": "45.1.0", "osc-js": "2.1.0",
    "selenium-webdriver": "4.0.0-alpha.7",
}
for name, version in expected.items():
    actual = json.loads((legacy / "node_modules" / name / "package.json").read_text(encoding="utf-8"))["version"]
    if actual != version:
        raise SystemExit("Version mismatch: " + name)
browser_lock = json.loads((source / "packaging/browser-toolchain.json").read_text(encoding="utf-8"))
# Keep temporary extraction alive until copying completes, including error cleanup.
browser_stage = tempfile.TemporaryDirectory(prefix="transplayer-browser-")
chrome, driver, extension = prepare_browser(
    args.browser_archives.resolve(), Path(browser_stage.name), browser_lock)
lock = json.loads((source / "package-lock.json").read_text(encoding="utf-8"))
for relative, metadata in lock["packages"].items():
    if not relative or metadata.get("dev"):
        continue
    installed = legacy / relative / "package.json"
    if not installed.is_file():
        raise SystemExit("Missing locked runtime dependency: " + relative)
    if json.loads(installed.read_text(encoding="utf-8"))["version"] != metadata["version"]:
        raise SystemExit("Locked dependency mismatch: " + relative)

output.mkdir(parents=True)
app = output / "app"
app.mkdir()
for name in ["main.js", "portable.js", "desktop-state.js", "desktop-guard.js",
             "desktop-modern-guard.js", "desktop-client.js", "chrome-session.js", "controller.js",
             "sub-process.js", "web-process-new.js", "package.json", "package-lock.json"]:
    shutil.copy2(str(source / name), str(app / name))
shutil.copytree(str(source / "app"), str(app / "app"))
shutil.copytree(str(source / "packaging/gnome49"), str(output / "gnome49"))
shutil.copytree(str(legacy / "node_modules/electron/dist"), str(output / "runtime"))
shutil.copytree(str(chrome), str(output / "browser"),
                ignore=shutil.ignore_patterns("cron", "default-app-block"))
# Copy locked non-dev packages only; nested dependencies are copied with their parent.
for relative, metadata in lock["packages"].items():
    if not relative or metadata.get("dev"):
        continue
    destination = app / relative
    if not destination.exists():
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(str(legacy / relative), str(destination),
                        ignore=shutil.ignore_patterns("._*", ".cache"))
(app / "bin/chrome").mkdir(parents=True)
shutil.copy2(str(driver), str(app / "bin/chrome/chromedriver"))
shutil.copy2(str(extension), str(app / "nopecha-0.6.1.zip"))
# Unpack the solver for the live chrome-first launch, which loads it via --load-extension
# (the legacy webdriver path keeps using the packed zip through Selenium addExtensions).
# Re-authorised by the artist 2026-11-06; SHA-pinned trusted artifact from browser-toolchain.json.
nopecha_dir = app / "nopecha"
with zipfile.ZipFile(str(extension)) as archive:
    for member in archive.namelist():
        target = (nopecha_dir / member).resolve()
        if not str(target).startswith(str(nopecha_dir.resolve())):
            raise ValueError("Unsafe path in solver archive")
    archive.extractall(str(nopecha_dir))
if not (nopecha_dir / "manifest.json").is_file():
    raise ValueError("Solver archive missing manifest.json")
browser_stage.cleanup()
for name in ["AppRun", "transplayer.desktop", "transplayer.svg"]:
    shutil.copy2(str(source / "packaging" / name), str(output / name))
# AppDir specification requires a raster .DirIcon; generate it without image dependencies.
def png_chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
pixels = bytearray()
for y in range(128):
    pixels.append(0)
    for x in range(128):
        edge = any(left <= x <= right and 26 <= y <= 102 and
                   (x < left + 4 or x > right - 4 or y < 30 or y > 98)
                   for left, right in [(20, 60), (68, 108)])
        pixels.extend((221, 221, 221) if edge else (32, 32, 36))
png = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", struct.pack(">IIBBBBB", 128, 128, 8, 2, 0, 0, 0))
png += png_chunk(b"IDAT", zlib.compress(bytes(pixels))) + png_chunk(b"IEND", b"")
(output / "transplayer.png").write_bytes(png)
(output / ".DirIcon").write_bytes(png)
(output / "AppRun").chmod(0o755)
# Never transfer setuid privileges into a user-writable portable directory.
for file in output.rglob("*"):
    if file.is_file():
        file.chmod(file.stat().st_mode & 0o777)
shutil.copy2(str(source / "config.example.json"), str(output / "config.example.json"))
(output / "VERSIONS.json").write_text(json.dumps({
    "runtime": expected, "node": "24.22.1",
    "chrome": browser_lock["version"], "chromedriver": browser_lock["version"],
    "browserToolchain": browser_lock,
    "platform": "linux-x64", "baseline": "Ubuntu 25.10 / GNOME 49 / Wayland + Xwayland",
    "installation": "Root-owned versioned AppDir with exact-path AppArmor userns profiles",
    "browserBackend": "chrome-first", "profileGeneration": "r9-basic", "passwordStore": "basic",
}, indent=2) + "\n")
with (output / "SHA256SUMS").open("w") as manifest:
    for file in sorted(output.rglob("*")):
        if not file.is_file() or file.name == "SHA256SUMS":
            continue
        digest = hashlib.sha256()
        with file.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        manifest.write("{}  {}\n".format(digest.hexdigest(), file.relative_to(output)))
print("BUILT", output)
