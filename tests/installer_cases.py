"""Portable tests: fixtures only, no GTK, root, PM2, dpkg or real desktop."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch
import subprocess
import hashlib
import io
import tarfile
import os

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "packaging/installer"))
import core


class SetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.video = self.home / "作品 with spaces.webm"
        self.video.write_bytes(b"synthetic media")

    def test_platform_is_exact(self):
        core.check_platform({"ID": "ubuntu", "VERSION_ID": "26.04"}, "x86_64", "50.0")
        for osinfo, arch, shell in [
            ({"ID": "ubuntu", "VERSION_ID": "25.10"}, "x86_64", "49"),
            ({"ID": "debian", "VERSION_ID": "26.04"}, "x86_64", "50"),
            ({"ID": "ubuntu", "VERSION_ID": "26.04"}, "arm64", "50"),
            ({"ID": "ubuntu", "VERSION_ID": "26.04"}, "x86_64", "51"),
        ]:
            with self.subTest(osinfo=osinfo, arch=arch, shell=shell):
                with self.assertRaises(core.SetupError):
                    core.check_platform(osinfo, arch, shell)

    def test_save_is_private_and_idempotent(self):
        core.configure(self.home, self.video, True)
        config = self.home / ".config/transplayer/config.json"
        self.assertEqual(json.loads(config.read_text())["videoPath"], str(self.video.resolve()))
        self.assertEqual(config.stat().st_mode & 0o777, 0o600)
        self.assertEqual(config.parent.stat().st_mode & 0o777, 0o700)
        auto = self.home / ".config/autostart/transplayer-r10.desktop"
        self.assertIn("Exec=/usr/bin/transplayer login", auto.read_text())
        core.configure(self.home, self.video, True)
        core.configure(self.home, self.video, False)
        self.assertFalse(auto.exists())
        self.assertTrue(self.video.exists())

    def test_existing_app_directory_becomes_private(self):
        base = self.home / ".config/transplayer"
        base.mkdir(parents=True, mode=0o755)
        base.chmod(0o755)
        parent_mode = base.parent.stat().st_mode
        core.configure(self.home, self.video)
        self.assertEqual(base.stat().st_mode & 0o777, 0o700)
        self.assertEqual(base.parent.stat().st_mode, parent_mode)

    def test_validation_error_during_write_rolls_back(self):
        core.configure(self.home, self.video)
        other = self.home / "other.webm"
        other.write_bytes(b"fixture")
        atomic = core._atomic
        failed = False
        def fail_once(path, data):
            nonlocal failed
            if path.name == "setup.json" and not failed:
                failed = True
                raise core.SetupError("synthetic refusal")
            return atomic(path, data)
        with patch.object(core, "_atomic", fail_once):
            with self.assertRaises(core.SetupError):
                core.configure(self.home, other, replace=True)
        self.assertEqual(core.load_owned(self.home)["videoPath"], str(self.video.resolve()))

    def test_cancel_validation_does_not_create_configuration(self):
        core.validate_video(self.video)
        self.assertFalse((self.home / ".config").exists())

    def test_missing_or_nonfile_video_is_rejected(self):
        for value in [self.home, self.home / "missing", "https://invalid/video"]:
            with self.assertRaises(core.SetupError):
                core.configure(self.home, value, False)
        self.assertFalse((self.home / ".config").exists())

    def test_symlink_and_foreign_config_are_not_overwritten(self):
        base = self.home / ".config"
        base.mkdir()
        target = self.home / "foreign"
        target.mkdir()
        (base / "transplayer").symlink_to(target, target_is_directory=True)
        with self.assertRaises(core.SetupError):
            core.configure(self.home, self.video, True)
        self.assertEqual(list(target.iterdir()), [])
        (base / "transplayer").unlink()
        (base / "transplayer").mkdir()
        config = base / "transplayer/config.json"
        config.write_text('{"foreign":true}')
        with self.assertRaises(core.SetupError):
            core.configure(self.home, self.video, False)
        self.assertEqual(config.read_text(), '{"foreign":true}')

    def test_foreign_autostart_prevents_partial_config_commit(self):
        folder = self.home / ".config/autostart"
        folder.mkdir(parents=True)
        auto = folder / "transplayer-r10.desktop"
        auto.write_text("unrelated")
        with self.assertRaises(core.SetupError):
            core.configure(self.home, self.video, True)
        self.assertFalse((self.home / ".config/transplayer/config.json").exists())
        self.assertEqual(auto.read_text(), "unrelated")

    def test_legacy_installation_is_not_adopted(self):
        folder = self.home / ".config/autostart"
        folder.mkdir(parents=True)
        (folder / "Transplayer-PM2.desktop").write_text("legacy")
        with self.assertRaises(core.SetupError):
            core.configure(self.home, self.video, True)

    def test_detach_retains_all_data_and_refuses_foreign_entry(self):
        core.configure(self.home, self.video, True)
        core.detach(self.home)
        self.assertTrue((self.home / ".config/transplayer/config.json").exists())
        self.assertTrue(self.video.exists())
        auto = self.home / ".config/autostart/transplayer-r10.desktop"
        auto.write_text("foreign")
        with self.assertRaises(core.SetupError):
            core.detach(self.home)
        self.assertEqual(auto.read_text(), "foreign")

    def test_changed_video_requires_explicit_confirmation(self):
        core.configure(self.home, self.video, False)
        other = self.home / "other.webm"
        other.write_bytes(b"synthetic")
        with self.assertRaises(core.SetupError):
            core.configure(self.home, other, False)
        core.configure(self.home, other, False, replace=True)
        config = self.home / ".config/transplayer/config.json"
        self.assertEqual(json.loads(config.read_text())["videoPath"], str(other.resolve()))
        self.assertTrue(list(config.parent.glob("config.backup-*.json")))
    def test_concurrent_setup_is_refused(self):
        with core.account_lock(self.home):
            with self.assertRaises(core.SetupError):
                core.configure(self.home, self.video, True)
        self.assertFalse((self.home / ".config/transplayer/config.json").exists())

    def test_modified_owned_config_is_refused(self):
        core.configure(self.home, self.video, False)
        config = self.home / ".config/transplayer/config.json"
        config.write_text("{}")
        with self.assertRaises(core.SetupError):
            core.load_owned(self.home)

    def test_write_failure_restores_previous_configuration(self):
        core.configure(self.home, self.video, False)
        config = self.home / ".config/transplayer/config.json"
        before = config.read_bytes()
        atomic = core._atomic
        failed = False

        def fail_once(path, data):
            nonlocal failed
            if path.name == "setup.json" and not failed:
                failed = True
                raise OSError("synthetic write failure")
            return atomic(path, data)

        with patch.object(core, "_atomic", fail_once):
            with self.assertRaises(core.SetupError):
                core.configure(self.home, self.video, True)
        self.assertEqual(config.read_bytes(), before)
        self.assertFalse((self.home / ".config/autostart/transplayer-r10.desktop").exists())
        self.assertEqual(core.load_owned(self.home)["videoPath"], str(self.video.resolve()))

class RuntimeTests(unittest.TestCase):
    def test_desktop_status_requires_current_revision_and_ready_dock(self):
        import runtime
        good = {"revision": 3, "active": False, "panelVisible": True,
                "dockSlides": [1], "dockOverlap": [False]}
        self.assertEqual(runtime.parse_desktop_status(repr((json.dumps(good),))), good)
        for value in [[], {**good, "revision": 2}, {**good, "dockSlides": []},
                      {**good, "dockOverlap": [None]}, {**good, "active": "false"}]:
            with self.subTest(value=value), self.assertRaises(core.SetupError):
                runtime.parse_desktop_status(repr((json.dumps(value),)))

    def test_monitor_probe_initializes_gdk_without_exiting_on_failure(self):
        import runtime
        gdk = MagicMock()
        gdk.init_check.return_value = (False, [])
        with self.assertRaises(core.SetupError):
            runtime.probe_monitors(gdk)
        gdk.Display.get_default.assert_not_called()
        gdk.init_check.return_value = (True, [])
        display = gdk.Display.get_default.return_value
        display.get_n_monitors.return_value = 1
        monitor = display.get_monitor.return_value
        monitor.get_scale_factor.return_value = 1
        rect = monitor.get_geometry.return_value
        rect.x, rect.y, rect.width, rect.height = 0, 0, 1080, 1920
        self.assertEqual(runtime.probe_monitors(gdk), [
            {"x": 0, "y": 0, "width": 1080, "height": 1920}])

    def test_desktop_check_uses_separate_process_for_gdk(self):
        import runtime
        monitors = [{"x": 0, "y": 0, "width": 1080, "height": 1920},
                    {"x": 1080, "y": 0, "width": 1080, "height": 1920}]
        status = {"revision": 3, "active": False, "panelVisible": True,
                  "dockSlides": [1], "dockOverlap": [False]}
        with patch.object(runtime, "run", side_effect=[
                json.dumps(monitors), repr((json.dumps(status),))]) as run:
            self.assertEqual(runtime.desktop_check(), status)
            self.assertEqual(run.call_args_list[0].args[0][-1], "--display-probe")
    def test_pm2_rejects_malformed_environment(self):
        import runtime
        for value in [None, [], "foreign"]:
            with self.subTest(value=value), self.assertRaises(core.SetupError):
                runtime.app_state([{"name": "transplayer-r10", "pm2_env": value}], {})

    def test_login_readiness_retries_then_stops_at_bound(self):
        import runtime
        good = {"active": False, "panelVisible": True}
        with patch.object(runtime, "desktop_check", side_effect=[core.SetupError("wait"), good]) as check, \
             patch.object(runtime.time, "sleep") as sleep:
            self.assertEqual(runtime.desktop_ready("login", attempts=3), good)
            self.assertEqual(check.call_count, 2)
            self.assertEqual(sleep.call_count, 1)
        with patch.object(runtime, "desktop_check", side_effect=core.SetupError("wait")) as check, \
             patch.object(runtime.time, "sleep") as sleep:
            with self.assertRaises(core.SetupError):
                runtime.desktop_ready("login", attempts=3)
            self.assertEqual(check.call_count, 3)
            self.assertEqual(sleep.call_count, 2)
        with patch.object(runtime, "desktop_check", side_effect=core.SetupError("wait")) as check:
            with self.assertRaises(core.SetupError):
                runtime.desktop_ready("start", attempts=3)
            self.assertEqual(check.call_count, 1)

    def test_maintenance_detaches_only_after_confirmed_stopped_state(self):
        import runtime
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder)
            video = home / "fixture.webm"
            video.write_bytes(b"fixture")
            core.configure(home, video, True)
            auto = home / ".config/autostart/transplayer-r10.desktop"
            online = [{"name": "transplayer-r10", "pm2_env": {
                "status": "online", "pm_exec_path": runtime.LAUNCHER}}]
            with patch.dict(os.environ, {}, clear=True), \
                 patch.object(runtime, "run", side_effect=["pong", json.dumps(online)]) as run:
                with self.assertRaises(core.SetupError):
                    runtime._supervisor(home, "prepare-maintenance")
                self.assertEqual(run.call_count, 2)
                self.assertTrue(auto.exists())
            with patch.object(runtime, "run", side_effect=["pong", "[]", "killed"]):
                runtime._supervisor(home, "prepare-maintenance")
            self.assertFalse(auto.exists())
            self.assertTrue(video.exists())
            self.assertTrue((home / ".config/transplayer/config.json").exists())

    def test_existing_supervisor_state_is_private(self):
        import runtime
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder)
            state = home / ".local/state/transplayer-r10"
            state.mkdir(parents=True)
            state.chmod(0o755)
            parent_mode = state.parent.stat().st_mode
            with patch.dict(os.environ, {"TRANSPLAYER_SMOKE_SECONDS": "1", "PM2_HOME": "/foreign",
                                        "NODE_OPTIONS": "--require=/foreign"}):
                env = runtime.session_env(home)
            self.assertEqual(state.stat().st_mode & 0o777, 0o700)
            self.assertEqual(state.parent.stat().st_mode, parent_mode)
            self.assertNotIn("TRANSPLAYER_SMOKE_SECONDS", env)
            self.assertNotIn("NODE_OPTIONS", env)
            self.assertEqual(env["PM2_HOME"], str(state))
    def test_pm2_is_pinged_before_json_and_preparation_never_stops_online_app(self):
        import runtime
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder)
            responses = ["pong", "[]", "killed"]
            with patch.object(runtime, "run", side_effect=responses) as run:
                self.assertIn("ready", runtime._supervisor(home, "prepare-maintenance"))
                self.assertEqual([call.args[0][-1] for call in run.call_args_list],
                                 ["ping", "jlist", "kill"])
            self.assertEqual((home / ".local/state/transplayer-r10").stat().st_mode & 0o777, 0o700)
    def test_media_probe_uses_argument_array_and_checks_original_dimensions(self):
        import runtime
        with tempfile.TemporaryDirectory() as folder:
            video = Path(folder) / "作品;$(not-a-command).webm"
            video.write_bytes(b"fixture")
            good = {"streams": [{"codec_type": "video", "width": 2160, "height": 1920}],
                    "format": {"duration": "780.01"}}
            with patch.object(runtime.subprocess, "run") as run:
                run.return_value = subprocess.CompletedProcess([], 0, json.dumps(good), "")
                runtime.check_media(video)
                self.assertEqual(run.call_args.args[0][-1], str(video.resolve()))
                self.assertNotIn("shell", run.call_args.kwargs)
                good["streams"][0]["width"] = 1920
                run.return_value.stdout = json.dumps(good)
                with self.assertRaises(core.SetupError):
                    runtime.check_media(video)

    def test_status_parser_refuses_foreign_app_and_stale_auth(self):
        import runtime
        info = {"name": "transplayer-r10", "pm2_env": {
            "status": "online", "pm_exec_path": runtime.LAUNCHER,
            "XAUTHORITY": "/synthetic/new", "DISPLAY": ":1"}}
        env = {"XAUTHORITY": "/synthetic/new", "DISPLAY": ":1"}
        self.assertEqual(runtime.app_state([info], env), "online")
        self.assertEqual(runtime.app_state([], env), "empty")
        for apps in [[info, info], [{"name": "foreign"}]]:
            with self.assertRaises(core.SetupError):
                runtime.app_state(apps, env)
        info["pm2_env"]["XAUTHORITY"] = "/synthetic/old"
        with self.assertRaises(core.SetupError):
            runtime.app_state([info], env)

    def test_display_probe_rejects_wrong_individual_monitors(self):
        import runtime
        runtime.check_displays([
            {"x": 0, "y": 0, "width": 1080, "height": 1920},
            {"x": 1080, "y": 0, "width": 1080, "height": 1920}])
        for monitors in [[], [{"x": 0, "y": 0, "width": 2160, "height": 1920}],
                         [{"x": 0, "y": 0, "width": 1000, "height": 1920},
                          {"x": 1000, "y": 0, "width": 1160, "height": 1920}]]:
            with self.assertRaises(core.SetupError):
                runtime.check_displays(monitors)


class DisplaySetupTests(unittest.TestCase):
    def monitors(self):
        return [{"x": 1080, "y": 0, "width": 1080, "height": 1920},
                {"x": 0, "y": 0, "width": 1080, "height": 1920}]

    def test_independent_rotations_use_logical_geometry_and_preserve_input(self):
        import display_setup
        for left, right in [(90, 90), (270, 270), (90, 270), (270, 90)]:
            monitors = self.monitors()
            monitors[0]["rotation"], monitors[1]["rotation"] = right, left
            before = json.dumps(monitors)
            plan = display_setup.pattern_plan(monitors)
            self.assertEqual([p["index"] for p in plan], [1, 0])
            self.assertEqual([p["side"] for p in plan], ["left", "right"])
            self.assertEqual(json.dumps(monitors), before)
        monitors = self.monitors()
        for m in monitors:
            m["x"] -= 1080
            m["y"] = -40
        self.assertEqual(display_setup.pattern_plan(monitors)[0]["bounds"]["x"], -1080)

    def test_invalid_geometry_cannot_produce_test_patterns(self):
        import display_setup
        for value in [None, {}, [], [None, None],
                      [{"x": 0, "y": 0}, {"x": 1080, "y": 0}],
                      [{**m, "width": True} for m in self.monitors()],
                      [{**m, "x": float("nan")} for m in self.monitors()],
                      [self.monitors()[0], self.monitors()[0]],
                      [self.monitors()[0], {**self.monitors()[1], "y": 1}],
                      [self.monitors()[0], {**self.monitors()[1], "x": -1}]]:
            with self.subTest(value=value), self.assertRaises(core.SetupError):
                display_setup.pattern_plan(value)

    def test_settings_launcher_is_fixed_and_does_not_apply_rotation(self):
        import display_setup
        gio = MagicMock()
        display_setup.open_settings(gio)
        gio.AppInfo.create_from_commandline.assert_called_once_with(
            "gnome-control-center display", None, gio.AppInfoCreateFlags.NONE)
        gio.AppInfo.create_from_commandline.return_value.launch.assert_called_once_with([], None)
        gio.AppInfo.create_from_commandline.return_value.launch.return_value = False
        with self.assertRaises(core.SetupError):
            display_setup.open_settings(gio)

    def test_pattern_guard_refuses_playback_and_holds_both_locks(self):
        import display_setup
        from contextlib import contextmanager
        held = set()
        @contextmanager
        def lock(name):
            held.add(name)
            try:
                yield
            finally:
                held.remove(name)
        with patch.object(display_setup.runtime, "system_lock", side_effect=lambda: lock("system")), \
             patch.object(display_setup, "account_lock", side_effect=lambda home: lock("account")), \
             patch.object(display_setup.runtime, "platform_check"), \
             patch.object(display_setup.runtime, "desktop_check", return_value={
                 "active": False, "panelVisible": True}) as status, \
             patch.object(display_setup, "controller_idle", return_value=True) as idle, \
             patch.object(display_setup, "_show") as show:
            show.side_effect = lambda: self.assertEqual(held, {"system", "account"})
            display_setup.show_patterns(Path("/synthetic"))
            self.assertEqual(held, set())
            show.assert_called_once()
            show.reset_mock()
            status.return_value["active"] = True
            with self.assertRaises(core.SetupError):
                display_setup.show_patterns(Path("/synthetic"))
            show.assert_not_called()
            status.return_value["active"] = False
            idle.return_value = False
            with self.assertRaises(core.SetupError):
                display_setup.show_patterns(Path("/synthetic"))
            show.assert_not_called()
            self.assertEqual(held, set())

    def test_controller_idle_rejects_listener_and_unreadable_socket_state(self):
        import display_setup
        good = "header\n0: 0100007F:1F90 00000000:0000 0A rest\n"
        with patch.object(Path, "read_text", return_value="header\n"):
            self.assertTrue(display_setup.controller_idle())
        with patch.object(Path, "read_text", return_value=good):
            self.assertFalse(display_setup.controller_idle())
        with patch.object(Path, "read_text", side_effect=PermissionError()):
            with self.assertRaises(core.SetupError):
                display_setup.controller_idle()

    def test_pattern_close_is_idempotent_and_destroys_all_windows(self):
        import display_setup
        windows = [MagicMock(), MagicMock()]
        quit_loop = MagicMock()
        run = display_setup.PatternRun(windows, quit_loop, lambda: True,
                                       lambda: True, now=lambda: 0)
        run.close()
        run.close()
        for window in windows:
            window.destroy.assert_called_once()
        quit_loop.assert_called_once()

    def test_pattern_tick_closes_on_layout_change_or_unconfirmed_fullscreen(self):
        import display_setup
        windows = [MagicMock(), MagicMock()]
        now = [0]
        run = display_setup.PatternRun(windows, MagicMock(), lambda: False,
                                       lambda: True, now=lambda: now[0])
        self.assertFalse(run.tick())
        self.assertIsInstance(run.error, core.SetupError)
        run = display_setup.PatternRun([MagicMock()], MagicMock(), lambda: True,
                                       lambda: False, now=lambda: now[0])
        self.assertTrue(run.tick())
        now[0] = 4
        self.assertFalse(run.tick())
        self.assertIsInstance(run.error, core.SetupError)
        run = display_setup.PatternRun([MagicMock()], MagicMock(),
            lambda: (_ for _ in ()).throw(core.SetupError("changed")), lambda: True)
        self.assertFalse(run.tick())
        self.assertIsInstance(run.error, core.SetupError)
    def test_gtk_callbacks_and_partial_construction_clean_up(self):
        import display_setup
        from types import SimpleNamespace
        for action in ("escape", "button", "timeout", "destroy", "layout", "fullscreen", "partial"):
            with self.subTest(action=action):
                gtk, gdk, glib = MagicMock(), MagicMock(), MagicMock()
                glib.Error = type("SyntheticGLibError", (Exception,), {})
                gtk.init_check.return_value = (True, [])
                windows, buttons = [MagicMock(), MagicMock()], [MagicMock(), MagicMock()]
                gtk.Window.side_effect = windows if action != "partial" else [
                    windows[0], RuntimeError("synthetic window failure")]
                gtk.Button.side_effect = buttons
                gdk.KEY_Escape = 65307
                gdk.WindowState.FULLSCREEN = 4
                display = gdk.Display.get_default.return_value
                monitors = [MagicMock(), MagicMock()]
                display.get_monitor.side_effect = lambda i: monitors[i]
                natives = [window.get_window.return_value for window in windows]
                display.get_monitor_at_window.side_effect = lambda native: monitors[
                    [1, 0][natives.index(native)]]
                for window in windows:
                    window.get_window.return_value.get_state.return_value = 4
                    window.get_allocated_width.return_value = 1080
                    window.get_allocated_height.return_value = 1920
                def execute():
                    handlers = {c.args[0]: c.args[1] for c in windows[0].connect.call_args_list}
                    if action == "escape":
                        handlers["key-press-event"](windows[0], SimpleNamespace(keyval=65307))
                    elif action == "button":
                        buttons[0].connect.call_args.args[1](buttons[0])
                    elif action == "timeout":
                        glib.timeout_add_seconds.call_args.args[1]()
                    elif action == "destroy":
                        self.assertIn("destroy", handlers)
                        handlers["destroy"](windows[0])
                    elif action == "layout":
                        gdk.Screen.get_default.return_value.connect.call_args.args[1]()
                    elif action == "fullscreen":
                        windows[0].get_window.return_value.get_state.return_value = 0
                        tick = glib.timeout_add.call_args.args[1]
                        tick.__self__.started -= 4
                        tick()
                glib.MainLoop.return_value.run.side_effect = execute
                gi = MagicMock()
                repository = SimpleNamespace(Gtk=gtk, Gdk=gdk, GLib=glib)
                with patch.dict(sys.modules, {"gi": gi, "gi.repository": repository}), \
                     patch.dict(os.environ), \
                     patch.object(display_setup.runtime, "probe_monitors", return_value=self.monitors()), \
                     patch.object(display_setup, "controller_idle", return_value=True):
                    if action in ("layout", "fullscreen"):
                        with self.assertRaises(core.SetupError):
                            display_setup._show()
                    elif action == "partial":
                        with self.assertRaisesRegex(RuntimeError, "synthetic window failure"):
                            display_setup._show()
                    else:
                        display_setup._show()
                for window in windows[:1] if action == "partial" else windows:
                    window.destroy.assert_called_once()
                if action != "partial":
                    self.assertEqual(glib.timeout_add_seconds.call_args.args[0], 120)
                    self.assertEqual(glib.timeout_add.call_args.args[0], 500)
                gtk.StyleContext.remove_provider_for_screen.assert_called_once()

class BundleTests(unittest.TestCase):
    def prepare_supervisor_fixture(self, root, metadata, installed_version=None, link=False):
        import tools_prepare
        lock = json.loads((ROOT / "packaging/supervisor/package-lock.json").read_text())
        relative = "node_modules/fsevents"
        lock["packages"][relative] = {"version": "2.3.3", **metadata}
        source = root / "source"
        shipped = source / "packaging/supervisor/package-lock.json"
        shipped.parent.mkdir(parents=True)
        shipped.write_text(json.dumps(lock))
        npm = root / "npm"
        npm.mkdir()
        (npm / "package-lock.json").write_bytes(shipped.read_bytes())
        for name, data in lock["packages"].items():
            if not name or name == relative:
                continue
            package = npm / name / "package.json"
            package.parent.mkdir(parents=True, exist_ok=True)
            package.write_text(json.dumps({"version": data["version"]}))
        if installed_version is not None:
            package = npm / relative / "package.json"
            package.parent.mkdir(parents=True)
            package.write_text(json.dumps({"version": installed_version}))
            if link:
                target = root / "outside-package.json"
                package.rename(target)
                package.symlink_to(target)
        pm2 = npm / "node_modules/pm2/bin/pm2"
        pm2.parent.mkdir(parents=True)
        pm2.write_bytes(b"synthetic PM2")
        archive = root / "node.tar"
        with tarfile.open(archive, "w") as tar:
            for name, data in [("node-v24.22.2-linux-x64/bin/node", b"synthetic node"),
                               ("node-v24.22.2-linux-x64/LICENSE", b"license")]:
                member = tarfile.TarInfo(name)
                member.size = len(data)
                tar.addfile(member, io.BytesIO(data))
        tool_lock = json.loads(json.dumps(tools_prepare.LOCK))
        tool_lock["node"]["sha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()
        with patch.object(tools_prepare, "SOURCE", source), \
             patch.object(tools_prepare, "LOCK", tool_lock):
            tools_prepare.prepare(archive, npm, root / "tools")
        return root / "tools"

    def test_supervisor_accepts_missing_only_foreign_platform_optionals(self):
        for metadata in [
            {"optional": True, "os": ["darwin"]},
            {"optional": True, "os": ["!linux"]},
            {"optional": True, "cpu": ["arm64"]},
            {"optional": True, "os": ["linux", "!linux"]},
        ]:
            with self.subTest(metadata=metadata), tempfile.TemporaryDirectory() as folder:
                tools = self.prepare_supervisor_fixture(Path(folder), metadata)
                self.assertTrue((tools / "pm2/bin/pm2").is_file())
                self.assertFalse((tools / "pm2/node_modules/fsevents").exists())

    def test_supervisor_missing_applicable_or_required_packages_still_fail(self):
        for metadata in [
            {"os": ["darwin"]},
            {"optional": False, "os": ["darwin"]},
            {"optional": "true", "os": ["darwin"]},
            {"optional": True},
            {"optional": True, "os": ["linux"]},
            {"optional": True, "os": ["!darwin"]},
            {"optional": True, "os": ["any"]},
            {"optional": True, "cpu": ["x64"]},
            {"optional": True, "os": "darwin"},
            {"optional": True, "os": [None]},
        ]:
            with self.subTest(metadata=metadata), tempfile.TemporaryDirectory() as folder:
                with self.assertRaises(ValueError):
                    self.prepare_supervisor_fixture(Path(folder), metadata)
                self.assertFalse((Path(folder) / "tools").exists())

    def test_supervisor_present_optional_wrong_version_is_not_hidden(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                self.prepare_supervisor_fixture(
                    Path(folder), {"optional": True, "os": ["darwin"]}, "2.3.2")
            self.assertFalse((Path(folder) / "tools").exists())

    def test_supervisor_optional_package_symlink_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                self.prepare_supervisor_fixture(
                    Path(folder), {"optional": True, "os": ["darwin"]}, "2.3.3", link=True)
            self.assertFalse((Path(folder) / "tools").exists())
    def test_nested_manifests_are_covered(self):
        import package_build as build
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            nested = root / "nested"
            nested.mkdir()
            (nested / "SHA256SUMS").write_bytes(b"nested receipt")
            build.manifest(root)
            build.verify_tree(root)
            (nested / "SHA256SUMS").write_bytes(b"tampered")
            with self.assertRaises(ValueError):
                build.verify_tree(root)
    def test_minimal_node_extraction_never_extracts_links_or_traversal(self):
        import tools_prepare
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = root / "node.tar"
            with tarfile.open(archive, "w") as tar:
                for name, data in [("node-v24.22.2-linux-x64/bin/node", b"synthetic"),
                                   ("node-v24.22.2-linux-x64/LICENSE", b"license")]:
                    item = tarfile.TarInfo(name)
                    item.size = len(data)
                    tar.addfile(item, io.BytesIO(data))
            tools_prepare.extract_node(archive, root / "node")
            self.assertEqual((root / "node/bin/node").read_bytes(), b"synthetic")
            with tarfile.open(archive, "w") as tar:
                item = tarfile.TarInfo("../escape")
                item.size = 1
                tar.addfile(item, io.BytesIO(b"x"))
            with self.assertRaises(ValueError):
                tools_prepare.extract_node(archive, root / "bad")
    def test_synthetic_staging_preserves_timeline_and_narrows_r10_identity(self):
        import package_build as build
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            bundle, tools = root / "bundle", root / "tools"
            bundle.mkdir()
            tools.mkdir()
            for name in ["AppRun", "runtime/electron", "browser/chrome",
                         "app/bin/chrome/chromedriver", "app/web-process-new.js",
                         "app/nopecha-0.6.1.zip", "app/nopecha/manifest.json",
                         "gnome49/metadata.json"]:
                file = bundle / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(b"synthetic")
            (bundle / "VERSIONS.json").write_text(json.dumps({
                "runtime": {"electron": "45.1.0"}}))
            for name in ["node/bin/node", "pm2/bin/pm2", "THIRD_PARTY_NOTICES.txt"]:
                file = tools / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(b"synthetic")
            (tools / "VERSIONS.json").write_text(json.dumps({"node": "24.22.2", "pm2": "7.1.1"}))
            build.manifest(bundle)
            build.manifest(tools)
            output = root / "stage"
            build.stage(bundle, tools, output, build.sha(bundle / "SHA256SUMS"),
                        build.sha(tools / "SHA256SUMS"), maintainer="Fixture <test@example.invalid>")
            self.assertIn("Maintainer: Fixture <test@example.invalid>",
                          (output / "DEBIAN/control").read_text())
            self.assertIn("gnome-control-center", (output / "DEBIAN/control").read_text())
            self.assertEqual((output / "usr/lib/transplayer/display_setup.py").read_bytes(),
                             (ROOT / "packaging/installer/display_setup.py").read_bytes())
            self.assertNotIn("agent@warp.dev", (output / "DEBIAN/control").read_text())
            self.assertIn("start --notify", (output / "usr/share/applications/transplayer-start.desktop").read_text())
            app = output / "opt/transplayer/releases/r10.AppDir"
            receipt = json.loads((app / "VERSIONS.json").read_text())
            self.assertEqual(receipt["profileGeneration"], "r10-basic")
            self.assertIn("26.04", receipt["baseline"])
            self.assertEqual((app / "app/web-process-new.js").read_bytes(), b"synthetic")
            self.assertFalse((app / "app/nopecha-0.6.1.zip").exists())
            # The unpacked solver ships for the chrome-first --load-extension launch.
            self.assertTrue((app / "app/nopecha/manifest.json").is_file())
            build.verify_tree(app)
            ext = output / "usr/share/gnome-shell/extensions/transplayer-desktop@transplayer.local"
            self.assertEqual(json.loads((ext / "metadata.json").read_text())["shell-version"], ["50"])
            self.assertIn('["r10"].map', (ext / "lease.mjs").read_text())
            self.assertNotIn('["r8", "r9"].map', (ext / "lease.mjs").read_text())
            self.assertIn("revision: 3,", (ext / "extension.js").read_text())
            self.assertFalse(any(p.is_symlink() for p in output.rglob("*")))
            with self.assertRaises(ValueError):
                build.stage(bundle, tools, output, build.sha(bundle / "SHA256SUMS"),
                            build.sha(tools / "SHA256SUMS"), maintainer="Fixture <test@example.invalid>")
    def test_manifest_rejects_missing_extra_tampered_paths_and_symlinks(self):
        import package_build
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            file = root / "ok"
            file.write_bytes(b"fixture")
            manifest = root / "SHA256SUMS"
            digest = hashlib.sha256(file.read_bytes()).hexdigest()
            manifest.write_text(digest + "  ok\n")
            package_build.verify_tree(root)
            file.write_bytes(b"tamper")
            with self.assertRaises(ValueError):
                package_build.verify_tree(root)
            file.write_bytes(b"fixture")
            (root / "extra").write_bytes(b"x")
            with self.assertRaises(ValueError):
                package_build.verify_tree(root)
            (root / "extra").unlink()
            file.unlink()
            file.symlink_to(manifest)
            with self.assertRaises(ValueError):
                package_build.verify_tree(root)
            file.unlink()
            manifest.write_text(digest + "  ../escape\n")
            with self.assertRaises(ValueError):
                package_build.verify_tree(root)
class MaintenanceTests(unittest.TestCase):
    def test_remove_is_reentrant_when_profiles_are_already_unloaded(self):
        import maintenance as m
        with patch.object(m, "guard", return_value=123), patch.object(m.os, "close"), \
             patch.object(m, "mark"), patch.object(m, "loaded_policies", return_value=set()), \
             patch.object(m.subprocess, "run") as run:
            m.main("prerm", ["remove"])
            m.main("prerm", ["remove"])
            run.assert_not_called()
        with patch.object(m, "guard", return_value=123), patch.object(m.os, "close"), \
             patch.object(m, "mark"), patch.object(m, "loaded_policies", return_value={m.POLICIES[0]}), \
             patch.object(m.subprocess, "run") as run:
            m.main("prerm", ["remove"])
            self.assertEqual(run.call_count, 1)
            self.assertEqual(run.call_args.args[0][-1], "/etc/apparmor.d/" + m.POLICIES[0])

    def test_preinst_refuses_wrong_platform_before_state_changes(self):
        import maintenance as m
        with patch.object(m.platform, "freedesktop_os_release", return_value={
                "ID": "ubuntu", "VERSION_ID": "25.10"}), \
             patch.object(m, "guard") as guard:
            with self.assertRaises(RuntimeError):
                m.main("preinst", ["install"])
            guard.assert_not_called()

    def test_install_upgrade_remove_lifecycle_keeps_gate_until_configured(self):
        import maintenance as m
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            with patch.object(m, "STATE", state), patch.object(m, "guard", return_value=123), \
                 patch.object(m.os, "close"), patch.object(m, "scan_processes"), \
                 patch.object(m, "trusted"), patch.object(m.subprocess, "run"), \
                 patch.object(m.platform, "freedesktop_os_release", return_value={
                     "ID": "ubuntu", "VERSION_ID": "26.04"}), \
                 patch.object(m.platform, "machine", return_value="x86_64"):
                m.main("preinst", ["install"])
                self.assertTrue((state / "maintenance").exists())
                m.main("postinst", ["configure"])
                self.assertFalse((state / "maintenance").exists())
                m.main("prerm", ["upgrade"])
                m.main("preinst", ["upgrade"])
                self.assertTrue((state / "maintenance").exists())
                m.main("postinst", ["configure"])
                self.assertFalse((state / "maintenance").exists())
    def test_configure_failure_retains_gate_and_retry_can_clear_it(self):
        import maintenance as m
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            with patch.object(m, "STATE", state), patch.object(m, "guard", return_value=123), \
                 patch.object(m.os, "close"), patch.object(m, "trusted"), \
                 patch.object(m, "scan_processes"), patch.object(m.subprocess, "run") as run:
                run.side_effect = subprocess.CalledProcessError(1, "synthetic parser")
                with self.assertRaises(subprocess.CalledProcessError):
                    m.main("postinst", ["configure"])
                self.assertTrue((state / "maintenance").exists())
                run.side_effect = None
                m.main("postinst", ["configure"])
                self.assertFalse((state / "maintenance").exists())
                m.main("postinst", ["configure"])
                with self.assertRaises(RuntimeError):
                    m.main("postinst", ["abort-upgrade"])
    def test_release_and_supervisor_processes_block_maintenance(self):
        import maintenance
        with tempfile.TemporaryDirectory() as folder:
            proc = Path(folder)
            for pid, target in [("1", "/usr/bin/systemd"),
                                ("2", "/opt/transplayer/releases/r10.AppDir/browser/chrome")]:
                p = proc / pid
                p.mkdir()
                (p / "exe").symlink_to(target)
            with self.assertRaises(RuntimeError):
                maintenance.scan_processes(proc)
            (proc / "2/exe").unlink()
            (proc / "2/exe").symlink_to("/usr/lib/transplayer/tools/node/bin/node")
            with self.assertRaises(RuntimeError):
                maintenance.scan_processes(proc)
            (proc / "2/exe").unlink()
            (proc / "2/exe").symlink_to("/usr/bin/other")
            maintenance.scan_processes(proc)

    def test_unreadable_executable_is_not_silently_skipped(self):
        import maintenance
        with tempfile.TemporaryDirectory() as folder:
            proc = Path(folder)
            (proc / "12").mkdir()
            with self.assertRaises(RuntimeError):
                maintenance.scan_processes(proc)

    def test_maintainer_hooks_embed_helper_without_new_package_imports(self):
        import package_build
        for name in ("preinst", "prerm", "postinst"):
            script = package_build.maintainer_script(name)
            compile(script, name, "exec")
            self.assertNotIn("import core", script)
            self.assertNotIn("Path.home", script)
            self.assertNotIn("subprocess.run(['npm'", script)
        self.assertTrue(package_build.maintainer_script("postrm").startswith("#!/bin/sh\n"))


class CLITests(unittest.TestCase):
    def test_screens_routes_to_guarded_pattern_process_and_refuses_root(self):
        import cli
        with patch.object(sys, "argv", ["transplayer", "screens"]), \
             patch.object(cli.os, "getuid", return_value=501), \
             patch("display_setup.show_patterns", return_value="closed") as show, \
             patch.object(sys, "stdout", io.StringIO()) as out:
            cli.main()
            show.assert_called_once_with(Path.home())
            self.assertEqual(out.getvalue(), "closed\n")
            show.reset_mock()
            with patch.object(cli.os, "getuid", return_value=0):
                with self.assertRaises(core.SetupError):
                    cli.main()
            show.assert_not_called()
    def test_doctor_is_path_free_and_refuses_existing_report(self):
        import cli
        with tempfile.TemporaryDirectory() as folder:
            report = Path(folder) / "report.json"
            args = ["transplayer", "doctor", "--report", str(report)]
            with patch.object(sys, "argv", args), patch.object(cli.os, "getuid", return_value=501), \
                 patch.object(cli.runtime, "platform_check", side_effect=core.SetupError("private path")), \
                 patch.object(cli.runtime, "desktop_check", return_value={}), \
                 patch.object(sys, "stdout", io.StringIO()) as out:
                cli.main()
                self.assertNotIn(folder, out.getvalue())
                self.assertNotIn("private path", out.getvalue())
                self.assertEqual(report.stat().st_mode & 0o777, 0o600)
                before = report.read_bytes()
                with self.assertRaises(FileExistsError):
                    cli.main()
                self.assertEqual(report.read_bytes(), before)
    def test_desktop_errors_notify_and_return_safe_exit(self):
        import cli
        with patch.object(cli, "main", side_effect=core.SetupError("synthetic failure")), \
             patch.object(sys, "argv", ["transplayer", "start", "--notify"]), \
             patch("wizard.notify") as notify, patch.object(sys, "stderr", io.StringIO()):
            self.assertEqual(cli.entry(), 78)
            notify.assert_called_once_with("synthetic failure")

    def test_child_waits_for_real_account_lock(self):
        with tempfile.TemporaryDirectory() as folder:
            home = Path(folder).resolve()
            video = home / "fixture.webm"
            video.write_bytes(b"fixture")
            core.configure(home, video)
            script = (
                "import sys; from pathlib import Path; "
                "sys.path.insert(0, sys.argv[1]); import core; "
                "core.load_owned(Path(sys.argv[2]), wait=True); print('LOCK_RELEASED')"
            )
            with core.account_lock(home):
                child = subprocess.Popen(["python3", "-c", script, str(ROOT / "packaging/installer"),
                                          str(home)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                try:
                    with self.assertRaises(subprocess.TimeoutExpired):
                        child.communicate(timeout=0.15)
                except BaseException:
                    child.kill()
                    child.communicate()
                    raise
            stdout, stderr = child.communicate(timeout=5)
            self.assertEqual((child.returncode, stdout, stderr), (0, "LOCK_RELEASED\n", ""))


if __name__ == "__main__":
    unittest.main(verbosity=2)
