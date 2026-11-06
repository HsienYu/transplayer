"""Build a dpkg staging tree from verified developer inputs, never as root."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat

SOURCE = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
RELEASE = json.loads((HERE / "release.json").read_text())


def sha(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_tree(root):
    if root.is_symlink() or not root.is_dir():
        raise ValueError("Input must be a regular directory")
    manifest = root / "SHA256SUMS"
    if manifest.is_symlink() or not manifest.is_file():
        raise ValueError("Missing manifest")
    expected = {}
    for line in manifest.read_text().splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  ([^\r\n]+)", line)
        if not match:
            raise ValueError("Invalid manifest line")
        digest, name = match.groups()
        path = PurePosixPath(name)
        if (path.is_absolute() or ".." in path.parts or str(path) != name
                or "\\" in name or name in expected or name == "SHA256SUMS"):
            raise ValueError("Unsafe/duplicate manifest path")
        expected[name] = digest
    actual = {}
    for p in root.rglob("*"):
        if p.is_symlink() or (not p.is_dir() and not p.is_file()):
            raise ValueError("Symlink/special input refused")
        if p.is_file() and p != manifest:
            if p.stat().st_mode & 0o6000:
                raise ValueError("Privileged executable mode refused")
            actual[p.relative_to(root).as_posix()] = sha(p)
    if not expected or actual != expected:
        raise ValueError("Manifest coverage or content mismatch")


def manifest(root):
    data = "".join(sha(p) + "  " + p.relative_to(root).as_posix() + "\n"
                   for p in sorted(root.rglob("*")) if p.is_file() and p != root / "SHA256SUMS")
    (root / "SHA256SUMS").write_text(data)


def maintainer_script(name):
    if name == "postrm":
        # postrm can run after nonessential dependencies have disappeared.
        # Persistent launch gate/data are deliberately retained.
        return "#!/bin/sh\n# No user data or system state is deleted here.\nexit 0\n"
    return ("#!/usr/bin/python3\n" + (HERE / "maintenance.py").read_text()
            + "\nentry(" + repr(name) + ")\n")


def write(root, relative, text, mode=0o644):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    path.chmod(mode)
    return path


def stage(bundle, tools, output, bundle_digest, tools_digest, maintainer=None):
    if not maintainer or not re.fullmatch(r"[^<>\r\n]+ <[^<>\s@]+@[^<>\s@]+>", maintainer):
        raise ValueError("An explicitly approved package maintainer name/contact is required")
    # A matching manifest is integrity, not authenticity. Digests must come
    # from a trusted build/provenance record, not from an untrusted payload.
    for root, digest in [(bundle, bundle_digest), (tools, tools_digest)]:
        if sha(root / "SHA256SUMS") != digest:
            raise ValueError("Input manifest digest mismatch")
        verify_tree(root)
    required = ["AppRun", "runtime/electron", "browser/chrome",
                "app/bin/chrome/chromedriver", "VERSIONS.json"]
    if any(not (bundle / p).is_file() for p in required):
        raise ValueError("Incomplete application bundle")
    versions = json.loads((bundle / "VERSIONS.json").read_text())
    if versions.get("runtime", {}).get("electron") != "45.1.0":
        raise ValueError("Unexpected Electron version")
    tool_versions = json.loads((tools / "VERSIONS.json").read_text())
    if tool_versions != {"node": RELEASE["node"], "pm2": RELEASE["pm2"]}:
        raise ValueError("Unexpected supervisor toolchain")
    for name in ("node/bin/node", "pm2/bin/pm2", "THIRD_PARTY_NOTICES.txt"):
        if not (tools / name).is_file():
            raise ValueError("Incomplete tools / license provenance")
    if output.exists():
        raise ValueError("Output exists; choose a new directory")
    output.mkdir(parents=True)
    app = output / RELEASE["appdir"].lstrip("/")
    shutil.copytree(bundle, app)
    # The packed solver zip served only the legacy webdriver path (not live in r10); drop it.
    # The chrome-first launch loads the UNPACKED app/nopecha/ via --load-extension, which is
    # kept. Solver re-authorised by the artist 2026-11-06; its license is the artist's call.
    (app / "app/nopecha-0.6.1.zip").unlink(missing_ok=True)
    # Do not bundle a GNOME49 extension inside the new application tree.
    if (app / "gnome49").exists():
        shutil.rmtree(app / "gnome49")
    write(app, "AppRun", "#!/bin/sh\nexec /usr/bin/transplayer play\n", 0o755)
    lib = output / "usr/lib/transplayer"
    lib.mkdir(parents=True)
    for p in HERE.glob("*.py"):
        shutil.copy2(p, lib / p.name)
    shutil.copy2(HERE / "release.json", lib / "release.json")
    shutil.copytree(tools, lib / "tools")
    write(lib, "session-launch.py",
          "#!/usr/bin/python3\nimport runpy\nimport sys\n"
          "sys.argv = [sys.argv[0], 'play']\n"
          "runpy.run_path('/usr/lib/transplayer/cli.py', run_name='__main__')\n", 0o755)
    write(output, "usr/bin/transplayer",
          "#!/bin/sh\nexec /usr/bin/python3 /usr/lib/transplayer/cli.py \"$@\"\n", 0o755)
    write(lib, "ecosystem.config.cjs", """module.exports = {apps: [{
  name: "transplayer-r10", script: "/usr/lib/transplayer/session-launch.py",
  interpreter: "/usr/bin/python3", instances: 1, exec_mode: "fork",
  autorestart: true, restart_delay: 10000, min_uptime: 20000,
  max_restarts: 30, stop_exit_codes: [78], kill_timeout: 20000,
  treekill: false, watch: false, merge_logs: true
}]};
""")
    ext = output / "usr/share/gnome-shell/extensions" / RELEASE["extensionUuid"]
    shutil.copytree(SOURCE / "packaging/gnome49", ext)
    (ext / "metadata.json").write_text(json.dumps({
        "uuid": RELEASE["extensionUuid"], "name": "Transplayer Exhibition Desktop",
        "description": "r10 RC desktop lease — awaiting hardware verification",
        "shell-version": ["50"], "version": RELEASE["extensionRevision"]}, indent=2) + "\n")
    # Keep the exact identity validation implementation. Generate only the
    # allowlisted release table from the same trusted version contract.
    lease = (ext / "lease.mjs").read_text()
    if lease.count('["r8", "r9"].map') != 1:
        raise ValueError("Unexpected desktop release template")
    lease = lease.replace('["r8", "r9"].map', json.dumps([RELEASE["release"]]) + ".map", 1)
    (ext / "lease.mjs").write_text(lease)
    extension = (ext / "extension.js").read_text()
    if extension.count("revision: 2,") != 1:
        raise ValueError("Unexpected desktop revision template")
    extension = extension.replace("revision: 2,", "revision: " + str(RELEASE["extensionRevision"]) + ",", 1)
    (ext / "extension.js").write_text(extension)
    for executable, relative in [("electron", "runtime/electron"), ("chrome", "browser/chrome")]:
        write(output, "etc/apparmor.d/transplayer-r10-" + executable,
              "abi <abi/4.0>,\ninclude <tunables/global>\n"
              "profile transplayer-r10-" + executable + " " + RELEASE["appdir"] + "/" + relative
              + " flags=(unconfined) {\n  userns,\n}\n")
    for suffix, label, action in [("setup", "Transplayer 設定", "setup"),
                                  ("start", "開始 Transplayer", "start"),
                                  ("stop", "停止 Transplayer", "stop")]:
        write(output, "usr/share/applications/transplayer-" + suffix + ".desktop",
              "[Desktop Entry]\nType=Application\nName=" + label
              + "\nExec=/usr/bin/transplayer " + action + " --notify"
              + "\nIcon=video-x-generic\nTerminal=false\nCategories=AudioVideo;\n")
    # Build receipts and licensing references are package data, not user data.
    write(output, "usr/share/doc/transplayer/BUILD-INPUTS.json",
          json.dumps({"bundleManifest": bundle_digest, "toolsManifest": tools_digest,
                      "release": RELEASE, "hardwareVerified": False}, indent=2) + "\n")
    for p in SOURCE.glob("docs/*.md"):
        shutil.copy2(p, write(output, "usr/share/doc/transplayer/" + p.name, ""))
    shutil.copy2(tools / "THIRD_PARTY_NOTICES.txt",
                 write(output, "usr/share/doc/transplayer/THIRD_PARTY_NOTICES.txt", ""))
    versions["release"] = RELEASE
    versions["baseline"] = RELEASE["platform"] + " / GNOME 50 — RC, hardware unverified"
    versions["profileGeneration"] = "r10-basic"
    versions["installation"] = "Debian-managed root-owned r10 AppDir with exact-path AppArmor profiles"
    (app / "VERSIONS.json").write_text(json.dumps(versions, indent=2) + "\n")
    manifest(app)
    write(output, "DEBIAN/control", """Package: transplayer
Version: """ + RELEASE["version"] + """
Section: video
Priority: optional
Architecture: amd64
Maintainer: """ + maintainer + """
Pre-Depends: python3, util-linux
Depends: python3-gi, gir1.2-gtk-3.0, gjs, gnome-shell (>= 50), gnome-shell (<< 51), gnome-shell-ubuntu-extensions, gnome-control-center, xwayland, apparmor, ffmpeg, x11-xserver-utils, libglib2.0-bin, libnss3, libatk1.0-0t64, libatk-bridge2.0-0t64, libcups2t64, libdrm2, libxkbcommon0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libgbm1, libasound2t64, libxss1
Description: Elephants and Stones exhibition player (unverified Ubuntu 26.04 RC)
 Includes an account-scoped setup interface and supervised desktop playback.
 Ubuntu 26.04 hardware verification is pending. External video required.
""")
    for name in ("preinst", "postinst", "prerm", "postrm"):
        write(output, "DEBIAN/" + name, maintainer_script(name), 0o755)
    # Normalize permissions; never carry setuid or group-writable inputs.
    for p in output.rglob("*"):
        if p.is_file():
            p.chmod(0o755 if p.stat().st_mode & 0o111 else 0o644)
        elif p.is_dir():
            p.chmod(0o755)
    return output
