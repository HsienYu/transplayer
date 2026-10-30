#!/usr/bin/env python3
"""Wrap a verified AppDir using a pinned tool and that tool's own runtime."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--tool", required=True, type=Path)
parser.add_argument("--appdir", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
tool = args.tool.resolve()
appdir = args.appdir.resolve()
output = args.output.resolve()
if output.exists():
    raise SystemExit("Output exists; choose a new release filename")
lock = json.loads((Path(__file__).parent / "toolchain.json").read_text(encoding="utf-8"))
data = tool.read_bytes()
if hashlib.sha256(data).hexdigest() != lock["appimagetool"]["sha256"]:
    raise SystemExit("AppImage tool checksum mismatch")
# Reuse the verified tool's Type-2 runtime instead of downloading a mutable latest runtime.
offset = int(subprocess.check_output([str(tool), "--appimage-offset"]).strip())
runtime = output.with_suffix(".runtime")
with runtime.open("xb") as stream:
    stream.write(data[:offset])
env = os.environ.copy()
env["ARCH"] = "x86_64"
subprocess.run([
    str(tool), "--runtime-file", str(runtime), "--no-appstream",
    "--mksquashfs-opt", "-processors", "--mksquashfs-opt", "2",
    str(appdir), str(output),
], env=env, check=True)
digest = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix(output.suffix + ".sha256").write_text(
    "{}  {}\n".format(digest, output.name), encoding="ascii")
print("APPIMAGE_SHA256", digest)
