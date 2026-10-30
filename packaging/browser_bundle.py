"""Validate and unpack the exact browser toolchain, compatible with Python 3.6."""
import hashlib
import json
from pathlib import PurePosixPath
import re
import stat
import subprocess
import zipfile


def verify_archive(archive, expected):
    digest = hashlib.sha256()
    with archive.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if not re.fullmatch(r"[0-9a-f]{64}", expected) or digest.hexdigest() != expected:
        raise ValueError("Browser toolchain checksum mismatch: " + archive.name)


def verify_version(output, expected):
    if re.findall(r"\b\d+\.\d+\.\d+\.\d+\b", output) != [expected]:
        raise ValueError("Browser/driver version mismatch: " + output.strip())


def validate_member(info):
    path = PurePosixPath(info.filename)
    if (not info.filename or path.is_absolute() or ".." in path.parts or
            "\\" in info.filename or stat.S_ISLNK(info.external_attr >> 16)):
        raise ValueError("Unsafe browser archive member")


def prepare_browser(archives, destination, lock):
    # Verify every input before extracting or executing any downloaded binary.
    for key in ("chrome", "chromedriver", "extension"):
        item = lock[key]
        verify_archive(archives / item["file"], item["sha256"])
    for key in ("chrome", "chromedriver"):
        item = lock[key]
        with zipfile.ZipFile(str(archives / item["file"])) as archive:
            for info in archive.infolist():
                validate_member(info)
            archive.extractall(str(destination))
            for info in archive.infolist():
                target = destination / info.filename
                if target.is_file():
                    # AppImage content is public application data, not secrets.
                    # Preserve executable bits, strip setuid/setgid and ensure
                    # files such as CfT deb.deps/rpm.deps are readable by users.
                    target.chmod(((info.external_attr >> 16) & 0o777) | 0o444)
        binary = destination / item["directory"] / key
        output = subprocess.check_output([str(binary), "--version"]).decode()
        verify_version(output, lock["version"])
    with zipfile.ZipFile(str(archives / lock["extension"]["file"])) as archive:
        for info in archive.infolist():
            validate_member(info)
        manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
    if (manifest.get("version") != lock["extension"]["version"] or
            manifest.get("manifest_version") != lock["extension"]["manifest_version"]):
        raise ValueError("Extension manifest version mismatch")
    return (destination / lock["chrome"]["directory"],
            destination / lock["chromedriver"]["directory"] / "chromedriver",
            archives / lock["extension"]["file"])
