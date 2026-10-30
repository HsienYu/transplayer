// Standalone GJS client, not Electron. Keep one bus connection until release.
const { Gio, GLib } = imports.gi;
const System = imports.system;
const pid = Number(ARGV[0]);
const owner = ARGV[1];
const loop = new GLib.MainLoop(null, false);
const connection = Gio.bus_get_sync(Gio.BusType.SESSION, null);
function call(method, signature, values) {
  return connection.call_sync("org.gnome.Shell",
    "/org/gnome/Shell/Extensions/Transplayer", "org.transplayer.Desktop",
    method, new GLib.Variant(signature, values), null,
    Gio.DBusCallFlags.NONE, 5000, null);
}
let stopped = false;
function stop() {
  if (stopped) return GLib.SOURCE_REMOVE;
  stopped = true;
  try {
    call("Release", "(s)", [owner]);
    print("DESKTOP_RESTORED");
    loop.quit();
  } catch (error) {
    printerr(error.message);
    System.exit(1);
  }
  return GLib.SOURCE_REMOVE;
}
try {
  call("Acquire", "(us)", [pid, owner]);
  print("DESKTOP_HIDDEN");
  const input = new Gio.DataInputStream({
    base_stream: new Gio.UnixInputStream({ fd: 0, close_fd: false }),
  });
  input.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, result) => {
    try { stream.read_line_finish(result); stop(); }
    catch (error) { printerr(error.message); System.exit(1); }
  });
  GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, 15, stop);
  GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, 2, stop);
  loop.run();
} catch (error) {
  printerr(error.message);
  System.exit(1);
}
