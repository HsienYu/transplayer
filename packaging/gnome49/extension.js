import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {Extension} from "resource:///org/gnome/shell/extensions/extension.js";
import {dockManager} from "file:///usr/share/gnome-shell/extensions/ubuntu-dock@ubuntu.com/extension.js";
import {DesktopLease, RELEASES} from "./lease.mjs";
const XML = `<node><interface name="org.transplayer.Desktop">
<method name="Acquire"><arg type="u" direction="in"/><arg type="s" direction="in"/></method>
<method name="Release"><arg type="s" direction="in"/></method>
<method name="Status"><arg type="s" direction="out"/></method>
</interface></node>`;
const decoder = new TextDecoder();

function read(file) {
  return decoder.decode(GLib.file_get_contents(file)[1]);
}

function trustedExecutable(exe) {
  if (!RELEASES.some(release => release.executable === exe)) return false;
  let file = Gio.File.new_for_path(exe);
  while (file) {
    const info = file.query_info("unix::uid,unix::mode,standard::is-symlink",
      Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
    if (info.get_is_symlink() || info.get_attribute_uint32("unix::uid") !== 0 ||
        (info.get_attribute_uint32("unix::mode") & 0o022)) return false;
    file = file.get_parent();
  }
  return true;
}

function processInfo(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("Invalid process identity");
  const status = read(`/proc/${pid}/status`);
  const result = {
    pid,
    uid: Number(/^Uid:\s+(\d+)/m.exec(status)[1]),
    ppid: Number(/^PPid:\s+(\d+)/m.exec(status)[1]),
    exe: GLib.file_read_link(`/proc/${pid}/exe`),
    args: read(`/proc/${pid}/cmdline`).split("\0"),
  };
  result.secureExecutable = trustedExecutable(result.exe);
  return result;
}

export default class TransplayerDesktop extends Extension {
  enable() {
    this._lease = new DesktopLease({
      panel: Main.panel, getDocks: () => dockManager?._allDocks || [],
      uid: new Gio.Credentials().get_unix_user(), targets: RELEASES,
    });
    this._object = Gio.DBusExportedObject.wrapJSObject(XML, this);
    this._object.export(Gio.DBus.session, "/org/gnome/Shell/Extensions/Transplayer");
    this._signal = Gio.DBus.session.signal_subscribe("org.freedesktop.DBus",
      "org.freedesktop.DBus", "NameOwnerChanged", "/org/freedesktop/DBus", null,
      Gio.DBusSignalFlags.NONE, (_c, _s, _p, _i, _n, params) => {
        const [name, oldOwner, newOwner] = params.deep_unpack();
        if (oldOwner && !newOwner) {
          try { this._lease.disconnect(name); }
          catch (e) { console.error("Transplayer disconnect restoration failed", e); }
        }
      });
  }

  AcquireAsync([pid, owner], invocation) {
    try {
      const sender = invocation.get_sender();
      const [clientPid] = Gio.DBus.session.call_sync("org.freedesktop.DBus",
        "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetConnectionUnixProcessID",
        new GLib.Variant("(s)", [sender]), new GLib.VariantType("(u)"),
        Gio.DBusCallFlags.NONE, 3000, null).deep_unpack();
      const client = processInfo(clientPid);
      const guard = processInfo(client.ppid);
      const player = processInfo(guard.ppid);
      this._lease.acquire(sender, pid, owner, [client, guard, player]);
      invocation.return_value(new GLib.Variant("()", []));
    } catch (e) {
      console.error("Transplayer acquisition failed", e);
      invocation.return_dbus_error("org.transplayer.Desktop.Failed", e.message);
    }
  }

  ReleaseAsync([owner], invocation) {
    try {
      this._lease.release(invocation.get_sender(), owner);
      invocation.return_value(new GLib.Variant("()", []));
    } catch (e) {
      invocation.return_dbus_error("org.transplayer.Desktop.Failed", e.message);
    }
  }

  Status() {
    return JSON.stringify({
      revision: 2,
      active: !!this._lease.snapshot, panelVisible: Main.panel.visible,
      dockSlides: (dockManager?._allDocks || []).map(d => d._slider?.slide_x ?? null),
      dockOverlap: (dockManager?._allDocks || []).map(d => d._intellihide?.getOverlapStatus() ?? null),
    });
  }

  disable() {
    if (this._signal) Gio.DBus.session.signal_unsubscribe(this._signal);
    this._signal = 0;
    try { this._lease?.disable(); }
    finally {
      this._object?.unexport();
      this._object = null;
      this._lease = null;
    }
  }
}
