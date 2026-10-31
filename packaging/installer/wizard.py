"""GTK is imported only on the target desktop, not by portable test collection."""
from pathlib import Path
import sys
import threading

from core import RELEASE, SetupError, configure, load_owned
import runtime


def show():
    import gi
    gi.require_version("Gtk", "3.0")
    from gi.repository import Gtk, GLib

    window = Gtk.Window(title="Transplayer 設定 — RC")
    window.set_default_size(700, 650)
    window.set_border_width(20)
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
    window.add(box)
    intro = Gtk.Label(label=(
        "Ubuntu 26.04 LTS 安裝候選版 — 待實機驗證\n"
        "選擇原作品影片，使用兩台左右相鄰的 1080×1920 直向螢幕、縮放 100%。\n"
        "每台可依吊掛方向獨立選擇旋轉 90° 或 270°，不必同方向。\n"
        "本工具不變更自動登入、螢幕旋轉、鎖定或系統鑰匙圈。\n"
        "展示瀏覽器使用未加密的專用儲存，請勿登入私人帳號或儲存密碼。"))
    intro.set_line_wrap(True)
    box.pack_start(intro, False, False, 0)
    chooser = Gtk.FileChooserButton(title="選擇作品影片")
    box.pack_start(chooser, False, False, 0)
    auto = Gtk.CheckButton(label="登入桌面後自動播放（不會設定帳號自動登入）")
    box.pack_start(auto, False, False, 0)
    replace = Gtk.CheckButton(label="確認變更既有 r10 影片設定（將保留舊設定備份）")
    box.pack_start(replace, False, False, 0)
    try:
        config = load_owned(Path.home())
        chooser.set_filename(config["videoPath"])
        auto.set_active((Path.home() / ".config/autostart/transplayer-r10.desktop").exists())
    except SetupError:
        pass  # A fresh account is expected; saving still rejects foreign state.
    message = Gtk.Label(label=RELEASE["status"])
    message.set_line_wrap(True)
    box.pack_end(message, False, False, 0)
    buttons = []
    busy = False

    def complete(text):
        nonlocal busy
        busy = False
        message.set_text(text)
        for button in buttons:
            button.set_sensitive(True)
        return False

    def task(fn):
        nonlocal busy
        if busy:
            return
        busy = True
        for button in buttons:
            button.set_sensitive(False)
        message.set_text("處理中，請稍候……")

        def worker():
            try:
                text = fn()
            except SetupError as error:
                text = str(error)
            except (OSError, ValueError, ImportError):
                text = "操作未完成，請檢查安裝與權限；必要時聯絡技術人員。"
            GLib.idle_add(complete, text)
        threading.Thread(target=worker, daemon=True).start()

    def save():
        # Read GTK controls on the GTK thread, never from the worker thread.
        filename, enabled, confirmed = chooser.get_filename(), auto.get_active(), replace.get_active()

        def work():
            runtime.platform_check()
            runtime.check_media(filename)
            configure(Path.home(), filename, enabled, confirmed)
            return "設定已儲存。請檢查桌面整合，再按「開始播放」。"
        task(work)

    def enable():
        local = Path.home() / ".local/share/gnome-shell/extensions" / RELEASE["extensionUuid"]
        if local.exists() or local.is_symlink():
            raise SetupError("發現同名使用者擴充套件；請由技術人員檢查。")
        runtime.platform_check()
        runtime.run(["gnome-extensions", "enable", RELEASE["extensionUuid"]])
        return "已送出啟用要求。若尚未載入，請自行登出再登入；已儲存設定會保留。"

    def desktop():
        runtime.platform_check()
        runtime.desktop_check()
        return "桌面基本檢查通過；仍須目視確認聲音、透明度與完整播放。"

    def settings():
        from display_setup import open_settings
        return open_settings()

    def patterns():
        return runtime.run([sys.executable, str(Path(__file__).with_name("cli.py")), "screens"],
                           timeout=150).strip()

    for label, callback in [
        ("儲存設定", save),
        ("啟用桌面整合", lambda: task(enable)),
        ("開啟系統顯示器設定", lambda: task(settings)),
        ("檢查螢幕與桌面", lambda: task(desktop)),
        ("顯示方向與左右測試圖（須先停止播放）", lambda: task(patterns)),
        ("開始播放", lambda: task(lambda: runtime.supervisor(Path.home(), "start"))),
        ("停止播放", lambda: task(lambda: runtime.supervisor(Path.home(), "stop"))),
        ("準備更新或移除（須先停止播放）",
         lambda: task(lambda: runtime.supervisor(Path.home(), "prepare-maintenance"))),
    ]:
        button = Gtk.Button(label=label)
        button.connect("clicked", lambda _button, cb=callback: cb())
        box.pack_start(button, False, False, 0)
        buttons.append(button)
    # Do not allow closing while a write is in progress. Before Save, closing
    # only dismisses the window; no settings have been committed.
    window.connect("delete-event", lambda *_: busy)
    window.connect("destroy", Gtk.main_quit)
    window.show_all()
    Gtk.main()


def notify(message):
    import gi
    gi.require_version("Gtk", "3.0")
    from gi.repository import Gtk
    dialog = Gtk.MessageDialog(message_type=Gtk.MessageType.ERROR,
        buttons=Gtk.ButtonsType.OK, text="Transplayer")
    dialog.format_secondary_text(message)
    dialog.run()
    dialog.destroy()
