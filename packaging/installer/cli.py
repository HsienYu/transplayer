#!/usr/bin/python3
"""Installed entry point; root is only used by separate package scripts."""
import argparse
import json
import os
from pathlib import Path
import sys

from core import RELEASE, SetupError, configure, detach
import runtime


def main():
    parser = argparse.ArgumentParser(description="Transplayer RC setup and operation")
    parser.add_argument("action", nargs="?", default="setup",
                        choices=["setup", "configure", "start", "stop", "status",
                                 "login", "play", "doctor", "detach", "enable-extension",
                                 "prepare-maintenance", "screens", "snapshot-seed",
                                 "snapshot-login"])
    parser.add_argument("--video", type=Path)
    parser.add_argument("--autostart", action="store_true")
    parser.add_argument("--replace", action="store_true", help="Confirm changing an owned configuration")
    parser.add_argument("--report", type=Path, help="Write a private path-free diagnostic report")
    parser.add_argument("--notify", action="store_true", help="Show operation errors on the desktop")
    args = parser.parse_args()
    if os.getuid() == 0:
        raise SetupError("請以一般展示帳號操作；不要使用 sudo。")
    home = Path.home()
    if args.action == "setup":
        from wizard import show
        show()
    elif args.action == "screens":
        from display_setup import show_patterns
        print(show_patterns(home))
    elif args.action == "configure":
        runtime.platform_check()
        runtime.check_media(args.video)
        configure(home, args.video, args.autostart, args.replace)
        print("設定已儲存。請檢查桌面後再開始播放。")
    elif args.action == "detach":
        # Refuse while own PM2 app is online; no broad signals.
        if runtime.supervisor(home, "status") == "online":
            raise SetupError("請先停止作品，再停用自動播放。")
        detach(home)
        print("已停用本帳號自啟；影片、設定及紀錄保留。")
    elif args.action == "enable-extension":
        runtime.platform_check()
        local = home / ".local/share/gnome-shell/extensions" / RELEASE["extensionUuid"]
        if local.exists() or local.is_symlink():
            raise SetupError("有同名使用者擴充套件，請由技術人員檢查；不會覆寫。")
        runtime.run(["gnome-extensions", "enable", RELEASE["extensionUuid"]])
        print("已送出啟用要求。若尚未載入，請自行登出再登入；不會自動登出。")
    elif args.action == "play":
        runtime.play(home)
    elif args.action == "snapshot-seed":
        runtime.seed(home)
    elif args.action == "snapshot-login":
        print(runtime.snapshot_login(home))
    elif args.action == "doctor":
        report = {"release": RELEASE["release"], "status": RELEASE["status"]}
        for name, check in [("platform", runtime.platform_check),
                            ("desktop", runtime.desktop_check)]:
            try:
                check()
                report[name] = "PASS"
            except (SetupError, ImportError, OSError):
                report[name] = "NOT_READY"
        # No home paths, raw exceptions, environment or browser contents.
        content = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
        if args.report:
            fd = os.open(args.report, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, "w") as out:
                out.write(content)
        print(content, end="")
    else:
        print(runtime.supervisor(home, args.action))


def entry():
    try:
        main()
        return 0
    except SetupError as error:
        message = str(error)
    except (OSError, ValueError, ImportError):
        message = "操作未完成；請確認套件、權限與設定，或聯絡技術人員。"
    print(message, file=sys.stderr)
    if "--notify" in sys.argv:
        try:
            from wizard import notify
            notify(message)
        except (ImportError, ValueError, RuntimeError):
            print("無法開啟桌面通知，請由終端執行 transplayer doctor。", file=sys.stderr)
    return 78


if __name__ == "__main__":
    sys.exit(entry())
