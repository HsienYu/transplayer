"""Assemble immutable Node/PM2 build inputs, never run them during preparation."""
import json
from pathlib import Path, PurePosixPath
import shutil
import tarfile

from package_build import HERE, SOURCE, manifest, sha

LOCK = json.loads((HERE / "tools-toolchain.json").read_text())


def extract_node(archive, output):
    prefix = "node-v" + LOCK["node"]["version"] + "-linux-x64"
    wanted = {prefix + "/bin/node": "bin/node", prefix + "/LICENSE": "LICENSE"}
    with tarfile.open(archive) as source:
        members = source.getmembers()
        seen = set()
        for m in members:
            path = PurePosixPath(m.name)
            if (path.is_absolute() or ".." in path.parts or "\\" in m.name
                    or m.name in seen):
                raise ValueError("Unsafe/duplicate Node archive path")
            seen.add(m.name)
            if m.name in wanted and (not m.isfile() or m.mode & 0o6000):
                raise ValueError("Unsafe Node binary/license member")
        if not set(wanted).issubset(seen):
            raise ValueError("Node binary/license missing")
        output.mkdir(parents=True)
        for m in members:
            if m.name not in wanted:
                continue  # npm/corepack links and unused modules are not shipped.
            p = output / wanted[m.name]
            p.parent.mkdir(exist_ok=True)
            with p.open("xb") as out:
                shutil.copyfileobj(source.extractfile(m), out)
            p.chmod(0o755 if p.name == "node" else 0o644)


def prepare(node_archive, npm_root, output):
    if sha(node_archive) != LOCK["node"]["sha256"]:
        raise ValueError("Official Node archive SHA-256 mismatch")
    shipped_lock = SOURCE / "packaging/supervisor/package-lock.json"
    if (npm_root / "package-lock.json").read_bytes() != shipped_lock.read_bytes():
        raise ValueError("Use npm ci with the committed supervisor lockfile")
    lock = json.loads(shipped_lock.read_bytes())
    for relative, metadata in lock["packages"].items():
        if not relative:
            continue
        package = npm_root / relative / "package.json"
        if not package.is_file() or json.loads(package.read_bytes())["version"] != metadata["version"]:
            raise ValueError("Installed supervisor dependency differs from lock")
    # Reject unexpected modules, special files and links except npm's .bin.
    modules = npm_root / "node_modules"
    for p in modules.rglob("*"):
        if ".bin" in p.relative_to(modules).parts:
            continue
        if p.is_symlink() or (not p.is_file() and not p.is_dir()):
            raise ValueError("Unexpected supervisor link/special input")
    if output.exists():
        raise ValueError("Output exists")
    output.mkdir(parents=True)
    extract_node(node_archive, output / "node")
    pm2 = modules / "pm2"
    if json.loads((pm2 / "package.json").read_text())["version"] != LOCK["pm2"]["version"]:
        raise ValueError("Wrong PM2 version")
    shutil.copytree(pm2, output / "pm2", ignore=shutil.ignore_patterns(".bin"))
    dependencies = output / "pm2/node_modules"
    dependencies.mkdir(exist_ok=True)
    for p in modules.iterdir():
        if p.name in ("pm2", ".bin", ".package-lock.json"):
            continue
        if not p.is_dir():
            raise ValueError("Unexpected module root entry")
        shutil.copytree(p, dependencies / p.name, ignore=shutil.ignore_patterns(".bin"),
                        dirs_exist_ok=True)
    shutil.copy2(shipped_lock, output / "package-lock.json")
    (output / "VERSIONS.json").write_text(json.dumps({
        "node": LOCK["node"]["version"], "pm2": LOCK["pm2"]["version"]}, indent=2) + "\n")
    (output / "THIRD_PARTY_NOTICES.txt").write_text(
        "Node " + LOCK["node"]["version"] + ": see node/LICENSE.\n"
        "PM2 " + LOCK["pm2"]["version"] + ": AGPL-3.0; source JavaScript and LICENSE "
        "are included in pm2/. Dependencies retain their license files.\n"
        "Source: https://github.com/Unitech/pm2\n"
        "Public redistribution requires a complete release-license review.\n")
    manifest(output)
