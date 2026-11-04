"""One approved maintenance diagnostic, not an installer or production launcher."""
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time

LIB = Path("/usr/lib/transplayer")
APP = Path("/opt/transplayer/releases/r10.AppDir")
HERE = Path(__file__).resolve().parent
HOME = Path.home()
MAIN_SHA = "a635f13cbc3f5bdf0ae10b1eeac64dc041eb4f1ca1278fd0af4e83fbcbca2fca"
ALLOW_SUDO_INSPECTION = False
INSPECTION_AUDIT = []
sys.path.insert(0, str(LIB))
import core
import runtime


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes():
    paths = [APP / "app/main.js", HOME / ".config/transplayer/config.json",
             HOME / ".config/transplayer/setup.json"]
    return {str(p): sha(p) for p in paths}


def environment():
    matches = []
    for p in Path("/proc").iterdir():
        if not p.name.isdigit():
            continue
        try:
            if p.stat().st_uid != os.getuid() or (p / "comm").read_text().strip() != "Xwayland":
                continue
            args = (p / "cmdline").read_bytes().split(bytes([0]))
            displays = [a.decode() for a in args if re.fullmatch(rb":\d+", a)]
            authority = Path(os.fsdecode(args[args.index(b"-auth") + 1]))
            require(len(displays) == 1 and authority.is_file()
                    and authority.stat().st_uid == os.getuid()
                    and os.access(authority, os.R_OK), "Invalid graphical credentials")
            matches.append((displays[0], str(authority)))
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            continue
    require(len(matches) == 1, "Need exactly one owned Xwayland")
    env = dict(os.environ)
    for key in ("NODE_OPTIONS", "NODE_PATH", "ELECTRON_RUN_AS_NODE"):
        env.pop(key, None)
    env.update(DISPLAY=matches[0][0], XAUTHORITY=matches[0][1],
               XDG_RUNTIME_DIR=f"/run/user/{os.getuid()}",
               DBUS_SESSION_BUS_ADDRESS=f"unix:path=/run/user/{os.getuid()}/bus")
    return env


def parse_options(args):
    allow = args[-1:] == ["--sudo-process-inspection"]
    action = args[:-1] if allow else args
    require(action in (["--check"], ["--run"]),
            "Use --check or --run, optionally followed by --sudo-process-inspection")
    return action[0], allow


def read_executable(pid, allow_sudo=False, timeout=2):
    if type(pid) is not int or pid <= 0:
        raise ValueError("Process inspection requires a positive integer PID")
    if not math.isfinite(timeout) or not 0 < timeout <= 2:
        raise ValueError("Process inspection timeout must be within (0, 2]")
    target = Path("/proc", str(pid), "exe")
    privileged = False
    try:
        executable = os.readlink(target)
    except PermissionError:
        if not allow_sudo:
            raise
        # Only this immutable system reader runs as root; never the Python/GUI.
        result = subprocess.run(["/usr/bin/sudo", "-n", "/usr/bin/readlink",
            "--zero", "--", str(target)], stdin=subprocess.DEVNULL,
            capture_output=True, timeout=timeout)
        if result.returncode:
            if not target.parent.exists():
                raise ProcessLookupError("Process exited during inspection")
            raise RuntimeError(f"Privileged inspection failed for PID {pid}; "
                               "authorize sudo -v in this terminal before retrying")
        require(result.stdout.endswith(b"\0") and result.stdout.count(b"\0") == 1,
                "Malformed privileged process inspection output")
        executable = os.fsdecode(result.stdout[:-1])
        privileged = True
    require(executable.startswith("/") and not any(c in executable for c in "\0\r\n"),
            "Invalid inspected executable path")
    if privileged:
        INSPECTION_AUDIT.append({"pid": pid, "method": "sudo-readlink", "executable": executable})
    return executable


def process_identity(path):
    fields = (path / "stat").read_text().rsplit(")", 1)[1].split()
    return {"pid": int(path.name), "uid": path.stat().st_uid,
            "parent": int(fields[1]), "start_ticks": int(fields[19])}


def owned_snapshot(proc=Path("/proc"), allow_sudo=None, deadline=None):
    if allow_sudo is None:
        allow_sudo = ALLOW_SUDO_INSPECTION
    if deadline is None:
        deadline = time.monotonic() + 10
    found = []
    for p in proc.iterdir():
        if not p.name.isdigit():
            continue
        try:
            before = process_identity(p)
            if before["uid"] != os.getuid():
                continue
            remaining = deadline - time.monotonic()
            require(remaining > 0, "Process inspection timed out")
            executable = read_executable(int(p.name), allow_sudo=allow_sudo,
                                         timeout=min(2, remaining))
            require(process_identity(p) == before, "Process identity changed during inspection")
            if executable.startswith(str(APP) + "/"):
                found.append(dict(before, executable=executable))
        except (FileNotFoundError, ProcessLookupError):
            continue
    return sorted(found, key=lambda value: value["pid"])


def owned_processes():
    return [value["pid"] for value in owned_snapshot()]


def port_count():
    count = 0
    for name in ("tcp", "tcp6"):
        for line in Path("/proc/net", name).read_text().splitlines()[1:]:
            fields = line.split()
            count += fields[3] == "0A" and fields[1].split(":")[1] == "1F90"
    return count


def idle_gate():
    require(not owned_processes(), "AppDir processes remain; abort")
    require(port_count() == 0, "Port8080 remains occupied; abort")
    status = runtime.desktop_check()
    require(not status["active"] and status["panelVisible"], "Desktop not restored; abort")
    return status


def private_json(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as out:
        json.dump(value, out, indent=2)
        out.write("\n")


def wait_idle(output, timeout=10, inspect=None, now=time.monotonic, pause=time.sleep):
    if not math.isfinite(timeout) or not 0 < timeout <= 10:
        raise ValueError("Shutdown timeout must be finite and within (0, 10]")
    started = now()
    if inspect is None:
        def inspect():
            audit_start = len(INSPECTION_AUDIT)
            processes = owned_snapshot(deadline=started + timeout)
            port = port_count()
            remaining = timeout - (now() - started)
            require(remaining > 0, "Shutdown inspection timed out")
            result = subprocess.run([sys.executable, "-c",
                "import sys,json;sys.path.insert(0,'/usr/lib/transplayer');"
                "import runtime;print(json.dumps(runtime.desktop_check()))"],
                capture_output=True, text=True, check=True, timeout=remaining)
            desktop = json.loads(result.stdout)
            return {"processes": processes, "port8080": port,
                    "privileged_checks": INSPECTION_AUDIT[audit_start:],
                    "desktop": {key: desktop[key] for key in ("active", "panelVisible")}}
    observations = []
    outcome = "error"
    error = None
    try:
        while True:
            snapshot = inspect()
            elapsed = now() - started
            observations.append(dict(snapshot, elapsed_seconds=elapsed))
            desktop = snapshot["desktop"]
            if elapsed > timeout:
                outcome = "timeout"
                raise RuntimeError("Shutdown settling timed out; inspect receipt")
            if (not snapshot["processes"] and snapshot["port8080"] == 0
                    and desktop["active"] is False and desktop["panelVisible"] is True):
                outcome = "idle"
                return desktop
            if elapsed >= timeout:
                outcome = "timeout"
                raise RuntimeError("Shutdown settling timed out; inspect receipt")
            pause(min(0.25, timeout - elapsed))
    except Exception as exc:
        error = {"type": type(exc).__name__, "message": str(exc)}
        raise
    finally:
        private_json(output, {"outcome": outcome, "observations": observations, "error": error})


def cli(action, env, output):
    result = subprocess.run(["/usr/bin/transplayer", action], env=env,
                            capture_output=True, text=True, timeout=60)
    private_json(output, {"action": action, "exit": result.returncode,
                         "stdout": result.stdout, "stderr": result.stderr})
    require(result.returncode == 0, f"CLI {action} failed; inspect private logs")
    return result.stdout.strip()


def cpu():
    return [int(v) for v in Path("/proc/stat").read_text().splitlines()[0].split()[1:9]]


def benchmark(mode, root, env, original):
    idle_gate()
    require(hashes() == original, "Baseline files changed")
    output = root / mode
    output.mkdir(mode=0o700)
    # The caller holds account_lock and has already validated this media path.
    probe_env = dict(env, GPU_PROBE_MODE=mode, GPU_PROBE_OUTPUT=str(output))
    command = [str(APP / "runtime/electron"), str(HERE / "probe.js"),
               "--ozone-platform=x11", "--enable-transparent-visuals",
               "--disable-setuid-sandbox"]
    start_cpu = cpu()
    samples = []
    with (output / "stdout.log").open("xb") as out, (output / "stderr.log").open("xb") as err:
        p = subprocess.Popen(command, env=probe_env, stdout=out, stderr=err,
                             start_new_session=True)
        deadline = time.monotonic() + 70
        try:
            while p.poll() is None:
                require(time.monotonic() < deadline, "Parent probe timeout")
                samples.append({"utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                "cpu": cpu()})
                time.sleep(1)
        finally:
            if p.poll() is None:
                require(os.getpgid(p.pid) == p.pid, "Probe process group identity changed")
                os.killpg(p.pid, signal.SIGTERM)
                try:
                    p.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(p.pid, signal.SIGKILL)
                    p.wait(timeout=5)
    finish_cpu = cpu()
    delta = [b - a for a, b in zip(start_cpu, finish_cpu)]
    stats = {"exit": p.returncode, "cpu_busy_percent":
             (sum(delta) - delta[3] - delta[4]) / sum(delta) * 100, "samples": samples}
    private_json(output / "resources.json", stats)
    print("ROUND_EXIT", mode, p.returncode, flush=True)
    wait_idle(output / "exit-settle.json")
    require(p.returncode == 0, f"{mode} failed; preserve logs and stop")
    require(hashes() == original, "Baseline changed during probe")
    result = json.loads((output / "result.json").read_text())
    print("ROUND_SUMMARY", json.dumps({"mode": mode, "dropped_percent": result["droppedPercent"],
          "submitted_per_wall_second": result["submittedPerWallSecond"],
          "cpu_busy_percent": stats["cpu_busy_percent"], "properties": result["properties"],
          "gpu_features": result["gpuFeatures"], "initial_alpha": result["initialAlpha"]}), flush=True)


def main():
    global ALLOW_SUDO_INSPECTION
    action, ALLOW_SUDO_INSPECTION = parse_options(sys.argv[1:])
    require(os.getuid() != 0, "Do not run as root")
    os.umask(0o077)
    env = environment()
    os.environ.update(env)
    runtime.platform_check()
    original = hashes()
    require(original[str(APP / "app/main.js")] == MAIN_SHA, "Installed main SHA mismatch")
    require(not (HOME / ".config/autostart/transplayer-r10.desktop").exists(), "Autostart must be off")
    config = core.load_owned(HOME)
    desktop = runtime.desktop_check()
    require(desktop["active"], "Expected active playback before maintenance")
    require(len(owned_processes()) > 0 and port_count() == 1, "Playback activity gate mismatch")
    print("PREFLIGHT_PASS", flush=True)
    if action == "--check":
        if ALLOW_SUDO_INSPECTION:
            receipt = HERE / ("check-inspection-" + datetime.datetime.now(
                datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ") + ".json")
            private_json(receipt, INSPECTION_AUDIT)
            print("INSPECTION_RECEIPT", receipt.name, flush=True)
        return
    root = HERE / ("evidence-" + datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    root.mkdir(mode=0o700)
    backup = root / "baseline"
    backup.mkdir(mode=0o700)
    for path in (HOME / ".config/transplayer/config.json", HOME / ".config/transplayer/setup.json",
                 APP / "app/main.js"):
        shutil.copy2(path, backup / path.name)
    for path in (HOME / ".local/state/transplayer-r10/logs").glob("*.log"):
        shutil.copy2(path, backup / path.name)
    private_json(root / "original-hashes.json", original)
    private_json(root / "initial-process-inspection.json", INSPECTION_AUDIT)
    stopped = False
    try:
        cli("stop", env, root / "stop.json")
        stopped = True
        wait_idle(root / "stop-settle.json")
        cli("prepare-maintenance", env, root / "prepare-maintenance.json")
        wait_idle(root / "maintenance-settle.json")
        print("STOP_GATE_PASS", flush=True)
        with runtime.system_lock(), core.account_lock(HOME):
            # Already validated under the lock; benchmark reads only this media path.
            for mode in ("software", "default-gpu"):
                benchmark(mode, root, dict(env, TRANSPLAYER_VIDEO=config["videoPath"]), original)
    finally:
        if stopped:
            wait_idle(root / "restore-settle.json")
            require(hashes() == original, "Cannot restore: baseline files changed")
            log = HOME / ".local/state/transplayer-r10/logs/transplayer-r10-out.log"
            offset = log.stat().st_size
            cli("start", env, root / "restore-start.json")
            time.sleep(20)
            with log.open() as source:
                source.seek(offset)
                fresh = source.read()
            values = [json.loads(line[9:]) for line in fresh.splitlines()
                      if line.startswith("PLAYBACK ")]
            progress = [v for v in values if v.get("event") == "playing"][-3:]
            require(len(owned_processes()) > 0 and port_count() == 1
                    and runtime.desktop_check()["active"], "RC restart not active")
            require(len(progress) >= 2 and progress[-1]["frames"] > progress[0]["frames"],
                    "Fresh playback progress not verified")
            private_json(root / "recovery.json", {"hashes_unchanged": hashes() == original,
                         "latest_playback": progress, "active": True,
                         "privileged_checks": INSPECTION_AUDIT})
            print("RESTORED_ORIGINAL_RC", json.dumps(progress), flush=True)
    print("AB_RUN_COMPLETE", root.name, flush=True)


if __name__ == "__main__":
    main()
