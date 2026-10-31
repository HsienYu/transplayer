"""Temporary direction/side patterns; never apply display configuration."""
import os
from pathlib import Path
import time

from core import SetupError, account_lock
import runtime


def pattern_plan(monitors):
    runtime.check_displays(monitors)
    ordered = sorted(enumerate(monitors), key=lambda item: item[1]["x"])
    return [{"index": index, "side": side,
             "bounds": {k: monitor[k] for k in ("x", "y", "width", "height")}}
            for (index, monitor), side in zip(ordered, ("left", "right"))]


def open_settings(gio=None):
    launch_errors = (OSError,)
    if gio is None:
        from gi.repository import Gio, GLib
        gio = Gio
        launch_errors = (OSError, GLib.Error)
    try:
        app = gio.AppInfo.create_from_commandline(
            "gnome-control-center display", None, gio.AppInfoCreateFlags.NONE)
        if not app.launch([], None):
            raise SetupError("無法開啟顯示器設定；請從系統設定手動開啟。")
    except launch_errors:
        raise SetupError("無法開啟顯示器設定；請從系統設定手動開啟。") from None
    return "請依實際吊掛方向分別設定旋轉；本工具不會自動變更。"


def controller_idle():
    try:
        for name in ("/proc/net/tcp", "/proc/net/tcp6"):
            for line in Path(name).read_text().splitlines()[1:]:
                fields = line.split()
                if fields[1].split(":")[1] == "1F90" and fields[3] == "0A":
                    return False
    except (OSError, IndexError):
        raise SetupError("無法確認播放器是否停止；不會顯示測試圖。") from None
    return True


def show_patterns(home):
    with runtime.system_lock(), account_lock(home):
        runtime.platform_check()
        status = runtime.desktop_check()
        if status["active"] or not status["panelVisible"] or not controller_idle():
            raise SetupError("請先正常停止作品，再測試螢幕方向。")
        _show()
    return "測試圖已關閉；方向與左右位置仍須由現場人員目視確認。"


class PatternRun:
    """Lifecycle independent of GTK; one exit path for every window."""
    def __init__(self, windows, quit_loop, unchanged, fullscreen, now=time.monotonic):
        self.windows, self.quit_loop = windows, quit_loop
        self.unchanged, self.fullscreen, self.now = unchanged, fullscreen, now
        self.started = now()
        self.closed = False
        self.error = None

    def close(self, error=None):
        if self.closed:
            return False
        self.closed, self.error = True, error
        for window in self.windows:
            window.destroy()
        self.quit_loop()
        return False

    def tick(self):
        if self.closed:
            return False
        try:
            if not self.unchanged():
                raise SetupError("螢幕或播放狀態已變動；請停止播放、確認排列後重試。")
            if self.now() - self.started >= 3 and not self.fullscreen():
                raise SetupError("無法確認測試圖全螢幕位置；請確認桌面後重試。")
        except (SetupError, OSError) as error:
            return self.close(error if isinstance(error, SetupError) else
                              SetupError("無法讀取螢幕狀態；請確認桌面後重試。"))
        return True


def _show():
    # GTK3 fullscreen_on_monitor uses GdkScreen monitor indices. Keep this
    # temporary child on Xwayland and verify the actual fullscreen result.
    os.environ["GDK_BACKEND"] = "x11"
    import gi
    gi.require_version("Gtk", "3.0")
    gi.require_version("Gdk", "3.0")
    from gi.repository import Gtk, Gdk, GLib
    ready, _argv = Gtk.init_check([])
    if not ready:
        raise SetupError("無法開啟測試圖；請在展示帳號的圖形桌面操作。")
    initial = runtime.probe_monitors(Gdk)
    plan = pattern_plan(initial)
    screen = Gdk.Screen.get_default()
    display = Gdk.Display.get_default()
    loop = GLib.MainLoop()
    windows, timers = [], []

    def unchanged():
        return runtime.probe_monitors(Gdk) == initial and controller_idle()

    def fullscreen():
        for window, item in zip(windows, plan):
            native = window.get_window()
            bounds = item["bounds"]
            if (native is None or not native.get_state() & Gdk.WindowState.FULLSCREEN
                    or window.get_allocated_width() != bounds["width"]
                    or window.get_allocated_height() != bounds["height"]
                    or display.get_monitor_at_window(native) != display.get_monitor(item["index"])):
                return False
        return len(windows) == 2

    run = PatternRun(windows, loop.quit, unchanged, fullscreen)
    provider = Gtk.CssProvider()
    provider.load_from_data(b"""
        .tp-pattern { color: white; }
        .tp-pattern.left { background: #102b4a; }
        .tp-pattern.right { background: #15412b; }
        .tp-arrow { font-size: 100px; }
        .tp-side { font-size: 52px; }
        .tp-help { font-size: 24px; }
    """)
    Gtk.StyleContext.add_provider_for_screen(screen, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
    changed = screen.connect("monitors-changed", lambda *_: run.close(
        SetupError("螢幕排列已變動；請確認設定後重新開啟測試圖。")))
    try:
        for item in plan:
            window = Gtk.Window(title="Transplayer 螢幕方向測試")
            windows.append(window)
            window.set_decorated(False)
            context = window.get_style_context()
            context.add_class("tp-pattern")
            context.add_class(item["side"])
            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=32)
            box.set_valign(Gtk.Align.CENTER)
            window.add(box)
            for text, style in [
                ("↑\n上方 / UP", "tp-arrow"),
                ("桌面左側 / LEFT" if item["side"] == "left" else "桌面右側 / RIGHT", "tp-side"),
                ("文字應正向、左右應與實體位置一致。\n每台可獨立旋轉 90° 或 270°。\n"
                 "按 Esc 或下方按鈕關閉全部測試圖。\n120 秒後自動關閉。", "tp-help"),
            ]:
                label = Gtk.Label(label=text)
                label.set_justify(Gtk.Justification.CENTER)
                label.get_style_context().add_class(style)
                box.pack_start(label, False, False, 0)
            button = Gtk.Button(label="關閉全部測試圖")
            button.connect("clicked", lambda *_: run.close())
            box.pack_start(button, False, False, 0)
            window.connect("delete-event", lambda *_: run.close() or True)
            window.connect("destroy", lambda *_: run.close())
            window.connect("key-press-event",
                           lambda _w, event: (run.close() or True)
                           if event.keyval == Gdk.KEY_Escape else False)
            bounds = item["bounds"]
            index = screen.get_monitor_at_point(
                bounds["x"] + bounds["width"] // 2, bounds["y"] + bounds["height"] // 2)
            window.fullscreen_on_monitor(screen, index)
            window.show_all()
        timers.append(GLib.timeout_add_seconds(120, run.close))
        timers.append(GLib.timeout_add(500, run.tick))
        if not run.closed:
            loop.run()
    except GLib.Error:
        raise SetupError("測試圖無法完成；請確認桌面後重試。") from None
    finally:
        # A fired source removes itself; only remove sources still attached.
        for source in timers:
            if GLib.MainContext.default().find_source_by_id(source):
                GLib.source_remove(source)
        screen.disconnect(changed)
        run.close()
        Gtk.StyleContext.remove_provider_for_screen(screen, provider)
    if run.error:
        raise run.error
