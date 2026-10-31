#!/usr/bin/env python3
"""Stage on macOS/Linux; --build requires a Linux amd64 build environment."""
import argparse
import platform
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent / "installer"))
from package_build import stage, sha


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--tools", type=Path, required=True)
    parser.add_argument("--bundle-manifest-sha256", required=True)
    parser.add_argument("--tools-manifest-sha256", required=True)
    parser.add_argument("--stage", type=Path, required=True)
    parser.add_argument("--maintainer", required=True, help="Approved Debian maintainer name and contact")
    parser.add_argument("--build", type=Path, help="New output .deb; requires Linux amd64")
    args = parser.parse_args()
    if args.build and (platform.system() != "Linux" or platform.machine() != "x86_64"):
        parser.error("Actual .deb build requires Linux amd64; use staging only on this host")
    if args.build and args.build.exists():
        parser.error("Output .deb already exists")
    stage(args.bundle, args.tools, args.stage,
          args.bundle_manifest_sha256, args.tools_manifest_sha256, args.maintainer)
    print("STAGING_TREE_CREATED — not an installable package")
    if args.build:
        subprocess.run(["dpkg-deb", "--root-owner-group", "--build",
                        str(args.stage), str(args.build)], check=True)
        args.build.with_suffix(".deb.sha256").write_text(sha(args.build) + "  " + args.build.name + "\n")
        print("DEB_BUILT — hardware acceptance still pending")


if __name__ == "__main__":
    main()
