"""Account-scoped setup. Does not install packages or modify desktop policy."""
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import tempfile
import uuid

RELEASE = json.loads(Path(__file__).with_name("release.json").read_text())
AUTO = ("[Desktop Entry]\nType=Application\nName=Transplayer\n"
        "Exec=/usr/bin/transplayer login\nTerminal=false\n"
        "X-Transplayer-Owner=r10\n")


class SetupError(Exception):
    """Safe, actionable message suitable for display without private paths."""


def check_platform(info, arch, shell):
    if (info.get("ID") != "ubuntu" or info.get("VERSION_ID") != "26.04"
            or arch not in ("amd64", "x86_64")
            or not re.fullmatch(r"50(?:\.\d+)*", shell)):
        raise SetupError("需要 Ubuntu 26.04 LTS amd64 與 GNOME 50；其他平台尚未驗證。")


def validate_video(value):
    try:
        path = Path(value).expanduser().resolve(strict=True)
        if not path.is_file() or not os.access(path, os.R_OK):
            raise ValueError()
        if any(c in str(path) for c in ("\0", "\n", "\r")):
            raise ValueError()
        return path
    except (OSError, ValueError, TypeError):
        raise SetupError("請選擇可讀取的本機影片檔案。") from None


def _safe(path, directory=False):
    """Reject symlinks, special files and foreign/writable storage."""
    if not path.exists() and not path.is_symlink():
        return
    st = path.lstat()
    if (stat.S_ISLNK(st.st_mode) or st.st_uid != os.getuid()
            or st.st_mode & 0o022
            or not (stat.S_ISDIR(st.st_mode) if directory else stat.S_ISREG(st.st_mode))):
        raise SetupError("設定位置不安全或屬於其他程式；請由技術人員檢查。")


def _dir(path, private=False):
    _safe(path, True)
    path.mkdir(mode=0o700, exist_ok=True)
    if private:
        path.chmod(0o700)


@contextmanager
def account_lock(home, wait=False):
    home = Path(home).resolve(strict=True)
    _safe(home, True)
    _dir(home / ".config")
    base = home / ".config/transplayer"
    _dir(base, private=True)
    _safe(base / "setup.lock")
    fd = os.open(base / "setup.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | (0 if wait else fcntl.LOCK_NB))
        yield home, base
    except BlockingIOError:
        raise SetupError("另一個設定程序正在執行，請稍後再試。") from None
    finally:
        os.close(fd)


def _atomic(path, data):
    _safe(path)
    fd, temp = tempfile.mkstemp(prefix=".setup-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as out:
            out.write(data)
            out.flush()
            os.fsync(out.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def _bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def _owned_config(base):
    config, marker = base / "config.json", base / "setup.json"
    for p in (config, marker):
        _safe(p)
    if config.exists() != marker.exists():
        raise SetupError("發現既有或不完整設定；請由技術人員處理，不會自動接管。")
    if not config.exists():
        return None
    try:
        state = json.loads(marker.read_bytes())
        if (state != {"release": "r10", "configSha256": hashlib.sha256(config.read_bytes()).hexdigest()}):
            raise ValueError()
        return json.loads(config.read_bytes())
    except (ValueError, KeyError):
        raise SetupError("既有設定已被修改或不屬於 r10；不會覆寫。") from None


def _autostart(home):
    folder = home / ".config/autostart"
    _safe(folder, True)
    for name in ("Transplayer-PM2.desktop", "Transplayer.desktop"):
        p = folder / name
        if p.exists() or p.is_symlink():
            raise SetupError("發現舊版自啟設定；請先依技術遷移程序處理。")
    path = folder / "transplayer-r10.desktop"
    _safe(path)
    if path.exists() and path.read_text() != AUTO:
        raise SetupError("自啟入口不屬於本安裝程式；不會覆寫。")
    return path


def configure(home, video, autostart=False, replace=False):
    video = validate_video(video)
    desired = {"videoPath": str(video), "startSeconds": 775,
               "expectedWidth": 2160, "expectedHeight": 1920}
    with account_lock(home) as (home, base):
        current = _owned_config(base)
        auto = _autostart(home)
        if current is not None and current != desired and not replace:
            raise SetupError("影片設定不同；請確認變更後再儲存。")
        _dir(auto.parent)
        data = _bytes(desired)
        changes = {base / "config.json": data, base / "setup.json": _bytes({
            "release": "r10", "configSha256": hashlib.sha256(data).hexdigest()}),
            auto: AUTO.encode() if autostart else None}
        before = {p: p.read_bytes() if p.exists() else None for p in changes}
        if current is not None and current != desired:
            backup = base / ("config.backup-" + uuid.uuid4().hex + ".json")
            with backup.open("xb") as out:
                os.chmod(backup, 0o600)
                out.write(before[base / "config.json"])
        applied = []
        try:
            for path, content in changes.items():
                if content is None:
                    if path.exists():
                        path.unlink()
                else:
                    _atomic(path, content)
                applied.append(path)
        except (OSError, SetupError):
            for path in reversed(applied):
                if before[path] is None:
                    path.unlink(missing_ok=True)
                else:
                    _atomic(path, before[path])
            raise SetupError("儲存失敗，已嘗試還原原設定；請檢查磁碟與權限。") from None


def detach(home):
    with account_lock(home) as (home, _base):
        auto = _autostart(home)
        if auto.exists():
            auto.unlink()


def load_owned(home, wait=False):
    with account_lock(home, wait=wait) as (_home, base):
        value = _owned_config(base)
        if value is None:
            raise SetupError("尚未完成設定，請先開啟 Transplayer 設定。")
        validate_video(value["videoPath"])
        return value
