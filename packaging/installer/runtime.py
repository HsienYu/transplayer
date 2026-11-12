"""Linux integration boundaries; portable tests mock subprocess and desktop APIs."""
import fcntl
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
import time
from contextlib import contextmanager

from core import (RELEASE, SetupError, _autostart, _dir, _owned_config,
                  account_lock, load_owned, validate_video)

LIB = Path("/usr/lib/transplayer")
APP = Path(RELEASE["appdir"])
LAUNCHER = str(LIB / "session-launch.py")
LOCK = Path("/var/lib/transplayer/start.lock")
MAINTENANCE = LOCK.with_name("maintenance")


def run(args, env=None, timeout=20):
    try:
        result = subprocess.run(args, env=env, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        raise SetupError("系統檢查無法執行或已逾時；請查看技術文件。") from None
    if result.returncode:
        raise SetupError("系統檢查未通過；請確認桌面、套件與權限，再重試。")
    return result.stdout


def platform_check():
    from core import check_platform
    output = run(["gnome-shell", "--version"])
    match = re.search(r"\b50(?:\.\d+)*\b", output)
    check_platform(platform.freedesktop_os_release(), platform.machine(),
                   match.group(0) if match else "")


def check_media(video):
    video = validate_video(video)
    try:
        info = json.loads(run(["ffprobe", "-v", "error", "-show_entries",
            "stream=codec_type,width,height:format=duration", "-of", "json",
            str(video)], timeout=30))
        videos = [s for s in info["streams"] if s["codec_type"] == "video"]
        if (len(videos) != 1 or videos[0]["width"] != 2160
                or videos[0]["height"] != 1920
                or not 779 <= float(info["format"]["duration"]) <= 781):
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise SetupError("影片須為原作品規格：2160×1920、約 780 秒。") from None


def check_displays(monitors):
    if (not isinstance(monitors, list) or len(monitors) != 2 or any(
            not isinstance(m, dict)
            or any(type(m.get(k)) is not int for k in ("x", "y", "width", "height"))
            or m["width"] != 1080 or m["height"] != 1920 for m in monitors)):
        raise SetupError("請於顯示器設定使用兩台 1080×1920 直向螢幕。")
    a, b = sorted(monitors, key=lambda m: m["x"])
    if a["y"] != b["y"] or b["x"] != a["x"] + 1080:
        raise SetupError("兩台螢幕須左右相鄰、頂端對齊，不可鏡像。")


def probe_monitors(gdk):
    # See GDK3 init_check and PyGObject threading docs: this runs only in
    # the probe subprocess's main thread, never the wizard's worker thread.
    ready, _argv = gdk.init_check([])
    if not ready:
        raise SetupError("無法連接圖形桌面；請在展示帳號桌面操作。")
    display = gdk.Display.get_default()
    if display is None:
        raise SetupError("找不到目前的圖形桌面。")
    monitors = []
    for i in range(display.get_n_monitors()):
        monitor = display.get_monitor(i)
        rect = monitor.get_geometry()
        if monitor.get_scale_factor() != 1:
            raise SetupError("兩台螢幕的縮放須為 100%。")
        monitors.append({k: getattr(rect, k) for k in ("x", "y", "width", "height")})
    return monitors


def desktop_check():
    monitors = json.loads(run([sys.executable, str(Path(__file__).resolve()), "--display-probe"]))
    check_displays(monitors)
    status = run(["gdbus", "call", "--session", "--dest", "org.gnome.Shell",
        "--object-path", "/org/gnome/Shell/Extensions/Transplayer",
        "--method", "org.transplayer.Desktop.Status"])
    return parse_desktop_status(status)


def parse_desktop_status(status):
    # gdbus returns a GVariant string tuple, never eval shell/Python code.
    import ast
    try:
        value = json.loads(ast.literal_eval(status)[0])
        if (not isinstance(value, dict)
                or value.get("revision") != RELEASE["extensionRevision"]
                or type(value.get("active")) is not bool
                or type(value.get("panelVisible")) is not bool
                or not isinstance(value.get("dockSlides"), list)
                or not isinstance(value.get("dockOverlap"), list)
                or not value["dockSlides"]
                or len(value["dockSlides"]) != len(value["dockOverlap"])
                or any(v is None for v in value["dockSlides"] + value["dockOverlap"])):
            raise ValueError()
    except (ValueError, SyntaxError, TypeError, KeyError, IndexError):
        raise SetupError("桌面擴充套件未就緒；請啟用後自行登出再登入。") from None
    return value


def app_state(apps, env):
    if apps == []:
        return "empty"
    if (not isinstance(apps, list) or len(apps) != 1 or not isinstance(apps[0], dict)
            or apps[0].get("name") != "transplayer-r10"):
        raise SetupError("隔離 PM2 狀態不符；不會修改其他程序。")
    value = apps[0].get("pm2_env", {})
    if not isinstance(value, dict):
        raise SetupError("隔離 PM2 狀態格式不符；請由技術人員檢查。")
    state = value.get("status")
    if (state not in ("online", "stopped")
            or value.get("pm_exec_path") != LAUNCHER
            or (state == "online" and any(value.get(k) != env.get(k)
                for k in ("XAUTHORITY", "DISPLAY")))):
        raise SetupError("播放器狀態或桌面授權不符；請依維護文件處理。")
    return state


def session_env(home):
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(("TRANSPLAYER_", "PM2_"))
           and k not in ("NODE_OPTIONS", "ELECTRON_RUN_AS_NODE", "NODE_PATH")}
    node_dir = LIB / "tools/node/bin"
    env["PATH"] = str(node_dir) + ":/usr/bin:/bin"
    folder = home / ".local"
    for name in ("", "state", "state/transplayer-r10"):
        p = folder / name
        _dir(p, private=name == "state/transplayer-r10")
    state = folder / "state/transplayer-r10"
    env["PM2_HOME"] = str(state)
    env["TRANSPLAYER_CONFIG"] = str(home / ".config/transplayer/config.json")
    env["TRANSPLAYER_NONINTERACTIVE"] = "1"
    # Node executable and PM2 are immutable root-owned package files.
    return env


@contextmanager
def system_lock(inherit=False):
    """All PM2 activity participates in the package-maintenance gate."""
    import stat
    for parent in (Path("/var"), Path("/var/lib"), LOCK.parent):
        info = parent.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise SetupError("系統啟動鎖目錄不安全。")
    fd = os.open(LOCK, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
            raise SetupError("系統啟動鎖不安全。")
        fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
        if MAINTENANCE.exists() or MAINTENANCE.is_symlink():
            raise SetupError("套件維護尚未完成；請由技術人員重新設定套件。")
        os.set_inheritable(fd, inherit)
        yield
    except BlockingIOError:
        raise SetupError("套件正在維護，暫停啟動。") from None
    finally:
        os.close(fd)


def supervisor(home, action):
    with system_lock():
        return _supervisor(home, action)


def desktop_ready(action, attempts=30):
    """Bounded startup grace for GNOME/Dock; manual starts fail immediately."""
    for attempt in range(attempts if action == "login" else 1):
        try:
            return desktop_check()
        except SetupError:
            if action != "login" or attempt == attempts - 1:
                raise
            time.sleep(2)


def _supervisor(home, action):
    with account_lock(home) as (home, base):
        env = session_env(home)
        pm2 = [str(LIB / "tools/node/bin/node"),
               str(LIB / "tools/pm2/bin/pm2")]
        config = _owned_config(base)
        if action in ("start", "login") and config is None:
            raise SetupError("請先開啟 Transplayer 設定並選擇影片。")
        if action in ("start", "login"):
            platform_check()
            for k in ("DISPLAY", "XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS", "XAUTHORITY"):
                if not env.get(k):
                    raise SetupError("目前登入缺少圖形桌面授權；請由桌面啟動。")
            if not os.access(env["XAUTHORITY"], os.R_OK):
                raise SetupError("目前的圖形桌面授權無法讀取。")
        run(pm2 + ["ping"], env)
        apps = json.loads(run(pm2 + ["jlist"], env))
        state = app_state(apps, env)
        if action == "status":
            return state
        if action == "stop":
            if state != "empty":
                run(pm2 + ["stop", "transplayer-r10"], env, 40)
            return "stopped"
        if action == "prepare-maintenance":
            if state == "online":
                raise SetupError("請先停止作品，再準備套件維護。")
            auto = _autostart(home)
            run(pm2 + ["kill"], env)
            if auto.exists():
                auto.unlink()
            return "supervisor stopped; ready for package maintenance — 已停用本帳號自啟，資料保留。"
        if state == "online":
            return "already running"
        check_media(config["videoPath"])
        status = desktop_ready(action)
        if status.get("active") or not status.get("panelVisible"):
            raise SetupError("桌面仍有作品租約；不會啟動第二個播放器。")
        if state == "stopped":
            run(pm2 + ["delete", "transplayer-r10"], env)
        run(pm2 + ["start", str(LIB / "ecosystem.config.cjs"), "--only", "transplayer-r10"], env)
        if action == "login":
            _spawn_seed(home)  # boot auto-login also refreshes the snapshot cache (best effort)
        return "start requested — inspect playback"


def play(home):
    """PM2 child: retain shared lock across exec for the whole player lifetime."""
    if os.getuid() == 0:
        raise SetupError("不可使用 root 播放作品。")
    with system_lock(inherit=True):
        load_owned(home, wait=True)
        env = session_env(home)
        env.update({
            "TRANSPLAYER_CHROME": str(APP / "browser/chrome"),
            "TRANSPLAYER_DRIVER": str(APP / "app/bin/chrome/chromedriver"),
            "TRANSPLAYER_PROFILE_DIR": str(home / ".local/share/transplayer/profiles-r10-basic"),
            "TRANSPLAYER_DESKTOP_BACKEND": "gnome49",
            "TRANSPLAYER_BROWSER_BACKEND": "chrome-first",
            # NopeCHA cannot solve the Enterprise reCAPTCHA this piece hits; the
            # snapshot cache handles gating instead. Loading the unpacked extension
            # only added an on-screen NopeCHA bar plus Chrome's "developer mode
            # extensions" warning bar, so keep it off.
            "TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION": "1",
        })
        os.execve(APP / "runtime/electron", [str(APP / "runtime/electron"), str(APP / "app"),
            "--ozone-platform=x11", "--enable-transparent-visuals", "--disable-setuid-sandbox"], env)


def _seed_env(home):
    env = session_env(home)
    env.update({
        "TRANSPLAYER_CHROME": str(APP / "browser/chrome"),
        "TRANSPLAYER_DRIVER": str(APP / "app/bin/chrome/chromedriver"),
        "TRANSPLAYER_PROFILE_DIR": str(home / ".local/share/transplayer/profiles-r10-basic"),
        "TRANSPLAYER_DESKTOP_BACKEND": "gnome49",
        "TRANSPLAYER_BROWSER_BACKEND": "chrome-first",
        "TRANSPLAYER_DISABLE_CAPTCHA_EXTENSION": "1",
        "ELECTRON_RUN_AS_NODE": "1",
    })
    return env


def seed(home):
    """One-shot snapshot seed: capture a clean image-results page for every query into the
    shared snapshot cache, rotating fresh Chrome profiles. Safe to run while the player is
    live (uses its own seed-* profiles; TRANSPLAYER_SEED stops it wiping the display's)."""
    if os.getuid() == 0:
        raise SetupError("不可使用 root 執行快照 seed。")
    env = _seed_env(home)
    for k in ("DISPLAY", "XDG_RUNTIME_DIR", "XAUTHORITY"):
        if not env.get(k):
            raise SetupError("快照 seed 需要圖形桌面授權；請由桌面執行。")
    os.execve(APP / "runtime/electron",
              [str(APP / "runtime/electron"), str(APP / "app/seed.js")], env)


def snapshot_login(home):
    """Open a visible Chrome on the persistent seed-account profile so the operator logs into
    a dedicated Google account once; the snapshot seed then uses it (a signed-in account gates
    far less). Runs as the display account and waits for the window to be closed."""
    if os.getuid() == 0:
        raise SetupError("不可使用 root 登入快照帳號。")
    env = session_env(home)
    for k in ("DISPLAY", "XDG_RUNTIME_DIR", "XAUTHORITY"):
        if not env.get(k):
            raise SetupError("登入需要圖形桌面授權；請由桌面執行。")
    profile = home / ".local/share/transplayer/profiles-r10-basic/seed-account"
    profile.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(APP / "browser/chrome"), "--user-data-dir=" + str(profile),
                    "--ozone-platform=x11", "--password-store=basic", "--no-first-run",
                    "--no-default-browser-check", "--disable-blink-features=AutomationControlled",
                    "https://accounts.google.com/"], env=env)
    return "登入視窗已關閉；快照 seed 之後會使用此帳號。請用專用（拋棄式）帳號，勿用私人帳號。"


def _spawn_seed(home):
    """Run the snapshot seed in the background at login so every boot refreshes the cache
    to same-day content. Best effort: never block or fail the player start on it."""
    electron = APP / "runtime/electron"
    try:
        if not electron.exists():
            return
        env = _seed_env(home)
        if not all(env.get(k) for k in ("DISPLAY", "XDG_RUNTIME_DIR", "XAUTHORITY")):
            return
        log_dir = home / ".local/state/transplayer-r10/logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        out = open(log_dir / "seed.log", "ab")
        subprocess.Popen([str(electron), str(APP / "app/seed.js")], env=env,
                         stdin=subprocess.DEVNULL, stdout=out, stderr=out,
                         start_new_session=True)
    except OSError:
        pass


if __name__ == "__main__":
    try:
        if sys.argv[1:] != ["--display-probe"]:
            raise SetupError("不支援的內部檢查。")
        import gi
        gi.require_version("Gdk", "3.0")
        from gi.repository import Gdk
        print(json.dumps(probe_monitors(Gdk)))
    except (SetupError, ImportError, ValueError, OSError):
        print("無法讀取目前桌面顯示器。", file=sys.stderr)
        sys.exit(78)
