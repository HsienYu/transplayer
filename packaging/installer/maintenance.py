"""Embedded verbatim into each dpkg hook: never import newly unpacked code."""
import fcntl
import os
from pathlib import Path
import platform
import stat
import subprocess
import sys

STATE = Path("/var/lib/transplayer")
POLICIES = ["transplayer-r10-electron", "transplayer-r10-chrome"]


def scan_processes(proc=Path("/proc")):
    for path in proc.iterdir():
        if not path.name.isdecimal():
            continue
        try:
            exe = os.readlink(path / "exe")
        except OSError:
            if not path.exists():
                continue  # Process vanished during the scan.
            try:
                status = (path / "status").read_text()
            except OSError:
                raise RuntimeError("Cannot inspect a live process; maintenance refused") from None
            if "\nState:\tZ" in status or "\nState:\tX" in status:
                continue  # Kernel has already released its executable.
            # Kernel threads have no userspace executable and Kthread: 1.
            if "\nKthread:\t1\n" in status:
                continue
            raise RuntimeError("Cannot inspect a live process; maintenance refused")
        if exe.startswith(("/opt/transplayer/releases/", "/usr/lib/transplayer/")):
            raise RuntimeError("Stop playback and prepare maintenance in every exhibition account first")


def trusted(path, directory=False):
    if path.is_symlink():
        raise RuntimeError("Unsafe package state symlink")
    st = path.stat()
    if (st.st_uid != 0 or st.st_mode & 0o022 or not
            (stat.S_ISDIR(st.st_mode) if directory else stat.S_ISREG(st.st_mode))):
        raise RuntimeError("Unsafe package state ownership or mode")


def guard():
    if os.getuid() != 0:
        raise RuntimeError("Package maintenance requires the package manager")
    for parent in [Path("/var"), Path("/var/lib")]:
        trusted(parent, True)
    if not STATE.exists():
        STATE.mkdir(mode=0o755)
    trusted(STATE, True)
    lock = STATE / "start.lock"
    if not lock.exists() and not lock.is_symlink():
        fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
        os.close(fd)
    trusted(lock)
    fd = os.open(lock, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        raise RuntimeError("Player is active; stop it before package maintenance") from None
    return fd


def mark():
    scan_processes()
    marker = STATE / "maintenance"
    if marker.exists() or marker.is_symlink():
        trusted(marker)
        if marker.read_text() != "transplayer-r10\n":
            raise RuntimeError("Unknown maintenance marker")
    else:
        with marker.open("x") as out:
            out.write("transplayer-r10\n")
        marker.chmod(0o644)


def clear():
    marker = STATE / "maintenance"
    if marker.exists():
        trusted(marker)
        if marker.read_text() != "transplayer-r10\n":
            raise RuntimeError("Unknown maintenance marker")
        marker.unlink()


def loaded_policies():
    # Root reads the kernel's loaded names; absent/inaccessible securityfs
    # is an error, never a reason to assume profiles were unloaded.
    text = Path("/sys/kernel/security/apparmor/profiles").read_text()
    return {line.split(" (", 1)[0] for line in text.splitlines()}


def main(hook, args):
    action = args[0] if args else ""
    if hook == "preinst" and action in ("install", "upgrade"):
        info = platform.freedesktop_os_release()
        if (info.get("ID") != "ubuntu" or info.get("VERSION_ID") != "26.04"
                or platform.machine() != "x86_64"):
            raise RuntimeError("This RC targets Ubuntu 26.04 LTS amd64 only")
        for release in ("r8", "r9"):
            if Path("/opt/transplayer/releases", release + ".AppDir").exists():
                raise RuntimeError("Manual exhibition installation found; use the migration runbook")
        lock = guard()
        try:
            mark()
        finally:
            os.close(lock)
    elif hook == "prerm" and action in ("remove", "upgrade", "deconfigure", "failed-upgrade"):
        lock = guard()
        try:
            mark()
            if action == "remove":
                loaded = loaded_policies()
                for name in POLICIES:
                    if name in loaded:
                        subprocess.run(["apparmor_parser", "-R", "/etc/apparmor.d/" + name],
                                       check=True, timeout=30)
        finally:
            os.close(lock)
    elif hook == "postinst" and action == "configure":
        lock = guard()
        try:
            mark()
            for name in POLICIES:
                subprocess.run(["apparmor_parser", "-r", "/etc/apparmor.d/" + name],
                               check=True, timeout=30)
            clear()
        finally:
            os.close(lock)
    elif hook == "postinst" and action in ("abort-upgrade", "abort-remove", "abort-deconfigure"):
        # Conservative: do not automatically reopen the launch gate after
        # package-manager failure. Restore/reconfigure a known package first.
        raise RuntimeError("Maintenance remains blocked; reconfigure the known-good package")
    elif hook == "postrm":
        # Files/profiles are package-managed; no HOME access or data deletion.
        # Keep the marker after removal/failure. Reinstall+configure clears it.
        if action not in ("remove", "purge", "upgrade", "failed-upgrade",
                          "abort-install", "abort-upgrade", "disappear"):
            raise RuntimeError("Unexpected postrm action")
    elif hook not in ("preinst", "prerm", "postinst"):
        raise RuntimeError("Unknown maintainer hook")


def entry(hook):
    try:
        main(hook, sys.argv[1:])
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        # Errors identify only fixed system paths; never inspect user state.
        print("Transplayer maintenance refused:", str(error), file=sys.stderr)
        sys.exit(1)
