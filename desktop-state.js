// This function runs inside GNOME Shell 3.28, not inside Electron.
function desktopAction(action, owner) {
  function restore(snapshot) {
    for (const item of snapshot.items) {
      if (item.signal) item.actor.disconnect(item.signal);
      item.actor.visible = item.visible;
    }
    delete global._transplayerDesktop;
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
  const actors = [imports.ui.main.panel.actor];
  if (manager) {
    for (const dock of manager._allDocks) actors.push(dock.actor);
  }
  const snapshot = { owner, items: actors.map(actor => ({
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
  } catch (error) {
    restore(snapshot);
    throw error;
  }
  return true;
}

function desktopScript(action, owner) {
  if (!["hide", "restore"].includes(action)) throw new Error("Invalid desktop action");
  if (typeof owner !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(owner)) {
    throw new Error("Invalid desktop owner");
  }
  return `(${desktopAction.toString()})(${JSON.stringify(action)},${JSON.stringify(owner)})`;
}

module.exports = { desktopScript };
