// This function runs inside GNOME Shell 3.28, not inside Electron.
function desktopAction(action, owner, overlayPid) {
  function restore(snapshot) {
    for (const item of snapshot.items) {
      if (item.signal) item.actor.disconnect(item.signal);
      item.actor.visible = item.visible;
    }
    for (const hook of snapshot.dockFilters) {
      if (hook.target._handledWindow === hook.wrapper) {
        if (hook.hadOwn) hook.target._handledWindow = hook.original;
        else delete hook.target._handledWindow;
      }
    }
    delete global._transplayerDesktop;
    for (const hook of snapshot.dockFilters) hook.target.forceUpdate();
  }
  const previous = global._transplayerDesktop;
  if (action === "restore") {
    if (!previous) return true;
    if (previous.owner !== owner) throw new Error("Desktop snapshot owner mismatch");
    restore(previous);
    return true;
  }
  if (previous) throw new Error("Desktop already owned by a Transplayer instance");
  const extension = imports.misc.extensionUtils.extensions["ubuntu-dock@ubuntu.com"];
  const manager = extension && extension.imports.extension.dockManager;
  if (!manager || !manager._allDocks.length || manager._allDocks.some(dock =>
    !dock._intellihide || typeof dock._intellihide._handledWindow !== "function" ||
    typeof dock._intellihide.forceUpdate !== "function")) {
    throw new Error("Unsupported Ubuntu Dock smart-hide API");
  }
  const actors = [imports.ui.main.panel.actor];
  const snapshot = { owner, dockFilters: [], items: actors.map(actor => ({
    actor, visible: actor.visible, signal: 0,
  })) };
  global._transplayerDesktop = snapshot;
  try {
    for (const item of snapshot.items) {
      item.signal = item.actor.connect("notify::visible", () => {
        if (item.actor.visible) item.actor.hide();
      });
      item.actor.hide();
    }
    for (const dock of manager._allDocks) {
      const target = dock._intellihide;
      const original = target._handledWindow;
      const wrapper = function(windowActor) {
        const window = windowActor.get_meta_window();
        if (window && window.get_pid() === overlayPid) return false;
        return original.call(this, windowActor);
      };
      snapshot.dockFilters.push({
        target, original, wrapper,
        hadOwn: Object.prototype.hasOwnProperty.call(target, "_handledWindow"),
      });
      target._handledWindow = wrapper;
      target.forceUpdate();
    }
  } catch (error) {
    restore(snapshot);
    throw error;
  }
  return true;
}

function desktopScript(action, owner, overlayPid) {
  if (!["hide", "restore"].includes(action)) throw new Error("Invalid desktop action");
  if (typeof owner !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(owner)) {
    throw new Error("Invalid desktop owner");
  }
  if (!Number.isSafeInteger(overlayPid) || overlayPid <= 0) {
    throw new Error("Invalid overlay PID");
  }
  return `(${desktopAction.toString()})(${JSON.stringify(action)},${JSON.stringify(owner)},${overlayPid})`;
}

module.exports = { desktopScript };
