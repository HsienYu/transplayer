"""Pure diagnostic-runner tests; no Linux desktop, signals or player commands."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest import mock

sys.modules["core"] = types.ModuleType("core")
sys.modules["runtime"] = types.ModuleType("runtime")
source = Path(__file__).resolve().parents[1] / "experiments/gpu-playback/run.py"
spec = importlib.util.spec_from_file_location("gpu_probe", source)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


def state(processes=None, port=0, active=False, panel=True):
    return {"processes": processes or [], "port8080": port,
            "desktop": {"active": active, "panelVisible": panel}}


class SettleTests(unittest.TestCase):
    def check_states(self, states, timeout=1):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        output = Path(folder.name) / "settle.json"
        clock = [0.0]
        index = [0]

        def inspect():
            value = states[min(index[0], len(states) - 1)]
            index[0] += 1
            if isinstance(value, Exception):
                raise value
            return value

        def pause(seconds):
            self.assertGreater(seconds, 0)
            clock[0] += seconds

        return output, lambda: probe.wait_idle(output, timeout=timeout,
            inspect=inspect, now=lambda: clock[0], pause=pause), clock

    def test_immediately_idle_records_one_observation(self):
        output, run, clock = self.check_states([state()])
        self.assertEqual(run()["active"], False)
        receipt = json.loads(output.read_text())
        self.assertEqual(receipt["outcome"], "idle")
        self.assertEqual(len(receipt["observations"]), 1)
        self.assertEqual(clock[0], 0)
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)

    def test_process_exit_is_waited_and_identity_preserved(self):
        identity = {"pid": 123, "start_ticks": 456, "executable": "/synthetic/electron"}
        output, run, clock = self.check_states([state([identity]), state()])
        run()
        self.assertEqual(json.loads(output.read_text())["observations"][0]["processes"], [identity])
        self.assertGreater(clock[0], 0)

    def test_listener_and_desktop_release_are_both_required(self):
        output, run, clock = self.check_states([
            state(port=1), state(active=True, panel=False), state(panel=False), state()])
        run()
        self.assertEqual(len(json.loads(output.read_text())["observations"]), 4)

    def test_timeout_never_accepts_persistent_activity(self):
        output, run, clock = self.check_states([state([{"pid": 999}])])
        with self.assertRaisesRegex(RuntimeError, "timed out"):
            run()
        receipt = json.loads(output.read_text())
        self.assertEqual(receipt["outcome"], "timeout")
        self.assertLessEqual(clock[0], 1.0)
        self.assertLessEqual(len(receipt["observations"]), 5)

    def test_probe_errors_are_preserved_not_treated_as_idle(self):
        output, run, clock = self.check_states([PermissionError("synthetic refusal")])
        with self.assertRaises(PermissionError):
            run()
        self.assertEqual(json.loads(output.read_text())["outcome"], "error")

    def test_invalid_deadlines_are_rejected(self):
        for timeout in (-1, 0, float("inf"), float("nan"), 11):
            with self.subTest(timeout=timeout):
                output, run, clock = self.check_states([state()], timeout)
                with self.assertRaises(ValueError):
                    run()

    def test_late_idle_observation_cannot_bypass_deadline(self):
        with tempfile.TemporaryDirectory() as folder:
            clock = [0.0]
            output = Path(folder) / "late.json"

            def inspect():
                clock[0] = 1.1
                return state()

            with self.assertRaisesRegex(RuntimeError, "timed out"):
                probe.wait_idle(output, timeout=1, inspect=inspect,
                                now=lambda: clock[0])
            self.assertEqual(json.loads(output.read_text())["outcome"], "timeout")


class ProcessInspectionTests(unittest.TestCase):
    def test_cli_defaults_to_no_privilege_and_refuses_ambiguous_arguments(self):
        self.assertEqual(probe.parse_options(["--check"]), ("--check", False))
        self.assertEqual(probe.parse_options(["--run", "--sudo-process-inspection"]),
                         ("--run", True))
        for args in [[], ["--check", "--run"], ["--run", "--unknown"],
                     ["--run", "--sudo-process-inspection", "--sudo-process-inspection"]]:
            with self.subTest(args=args), self.assertRaises(RuntimeError):
                probe.parse_options(args)

    def test_invalid_inspection_budgets_do_not_run_commands(self):
        for timeout in [0, -1, float("inf"), float("nan"), 3]:
            with self.subTest(timeout=timeout), \
                    mock.patch.object(probe.subprocess, "run") as run:
                with self.assertRaises(ValueError):
                    probe.read_executable(123, allow_sudo=True, timeout=timeout)
                run.assert_not_called()
    def test_readable_process_does_not_invoke_sudo(self):
        with mock.patch.object(probe.os, "readlink", return_value="/synthetic/electron"), \
                mock.patch.object(probe.subprocess, "run") as run:
            self.assertEqual(probe.read_executable(123, allow_sudo=True), "/synthetic/electron")
            run.assert_not_called()

    def test_permission_error_requires_explicit_opt_in(self):
        with mock.patch.object(probe.os, "readlink", side_effect=PermissionError("synthetic")), \
                mock.patch.object(probe.subprocess, "run") as run:
            with self.assertRaises(PermissionError):
                probe.read_executable(123)
            run.assert_not_called()

    def test_opt_in_uses_only_fixed_noninteractive_readlink_argv(self):
        reply = types.SimpleNamespace(returncode=0, stdout=b"/usr/lib/systemd/systemd\0")
        with mock.patch.object(probe.os, "readlink", side_effect=PermissionError("synthetic")), \
                mock.patch.object(probe.subprocess, "run", return_value=reply) as run:
            self.assertEqual(probe.read_executable(123, allow_sudo=True, timeout=0.5),
                             "/usr/lib/systemd/systemd")
            args, kwargs = run.call_args
            self.assertEqual(args[0], ["/usr/bin/sudo", "-n", "/usr/bin/readlink",
                                      "--zero", "--", "/proc/123/exe"])
            self.assertEqual(kwargs["stdin"], probe.subprocess.DEVNULL)
            self.assertEqual(kwargs["timeout"], 0.5)
            self.assertFalse(kwargs.get("shell", False))
            self.assertNotIn("input", kwargs)

    def test_privileged_failure_and_timeout_never_count_as_idle(self):
        for reply in [types.SimpleNamespace(returncode=1, stdout=b""),
                      probe.subprocess.TimeoutExpired("synthetic readlink", 0.5)]:
            with self.subTest(reply=type(reply).__name__), \
                    mock.patch.object(probe.os, "readlink", side_effect=PermissionError("synthetic")), \
                    mock.patch.object(probe.Path, "exists", return_value=True), \
                    mock.patch.object(probe.subprocess, "run") as run:
                if isinstance(reply, Exception):
                    run.side_effect = reply
                else:
                    run.return_value = reply
                with self.assertRaises((RuntimeError, probe.subprocess.TimeoutExpired)):
                    probe.read_executable(123, allow_sudo=True, timeout=0.5)

    def test_hostile_pid_and_malformed_output_are_rejected(self):
        for pid in [0, -1, True, "123;id", "../123", 1.5]:
            with self.subTest(pid=pid), mock.patch.object(probe.subprocess, "run") as run:
                with self.assertRaises(ValueError):
                    probe.read_executable(pid, allow_sudo=True)
                run.assert_not_called()
        for text in [b"", b"relative\0", b"/first\0/second\0", b"/bad\npath\0"]:
            with self.subTest(text=text), \
                    mock.patch.object(probe.os, "readlink", side_effect=PermissionError("synthetic")), \
                    mock.patch.object(probe.subprocess, "run",
                        return_value=types.SimpleNamespace(returncode=0, stdout=text)):
                with self.assertRaises(RuntimeError):
                    probe.read_executable(123, allow_sudo=True)

    def test_snapshot_rejects_changed_identity_instead_of_accepting_reused_pid(self):
        identity = {"pid": 123, "uid": probe.os.getuid(), "parent": 1, "start_ticks": 456}
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "123").mkdir()
            with mock.patch.object(probe, "process_identity",
                    side_effect=[identity, dict(identity, start_ticks=457)]), \
                    mock.patch.object(probe, "read_executable",
                                      return_value=str(probe.APP / "runtime/electron")):
                with self.assertRaisesRegex(RuntimeError, "identity"):
                    probe.owned_snapshot(proc=Path(folder))


if __name__ == "__main__":
    unittest.main()
