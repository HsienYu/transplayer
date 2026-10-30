const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { desktopScript } = require("../desktop-state");

function actor(visible) {
  const listeners = new Map();
  let next = 0;
  return {
    visible,
    connect(name, callback) { listeners.set(++next, callback); return next; },
    disconnect(id) { listeners.delete(id); },
    hide() { this.visible = false; },
    show() { this.visible = true; for (const listener of listeners.values()) listener(); },
    listeners,
  };
}
function desktop() {
  const panel = actor(true), dock = actor(true), hiddenDock = actor(false);
  function intellihide() {
    return {
      updates: 0,
      _handledWindow(window) { assert.equal(this.enabled, true); return !!window.get_meta_window(); },
      forceUpdate() { this.updates++; },
      enabled: true,
    };
  }
  const docks = [dock, hiddenDock].map(actor => ({ actor, _intellihide: intellihide() }));
  const originals = docks.map(d => d._intellihide._handledWindow);
  const context = vm.createContext({
    global: {},
    imports: {
      ui: { main: { panel: { actor: panel } } },
      misc: { extensionUtils: { extensions: {
        "ubuntu-dock@ubuntu.com": { imports: { extension: {
          dockManager: { _allDocks: docks },
        } } },
      } } },
    },
  });
  return { panel, dock, hiddenDock, docks, originals, context,
    run: (action, owner = "test-owner") => vm.runInContext(desktopScript(action, owner, 1234), context) };
}

test("hide suppresses only the panel and leaves native Dock visibility alone", () => {
  const d = desktop();
  assert.equal(d.run("hide"), true);
  assert.equal(d.panel.visible, false);
  assert.equal(d.dock.visible, true);
  d.panel.show();
  assert.equal(d.panel.visible, false);
  d.dock.hide();
  d.dock.show();
  assert.equal(d.dock.visible, true);
  assert.equal(d.dock.listeners.size, 0);
});

test("every Dock ignores only the owning transparent player PID", () => {
  const d = desktop();
  d.run("hide");
  const window = pid => ({ get_meta_window: () => ({ get_pid: () => pid }) });
  for (const dock of d.docks) {
    assert.equal(dock._intellihide._handledWindow(window(1234)), false);
    assert.equal(dock._intellihide._handledWindow(window(5678)), true);
    assert.equal(dock._intellihide._handledWindow({ get_meta_window: () => null }), false);
  }
});

test("restoration does not undo native Dock visibility changes", () => {
  const d = desktop();
  d.run("hide");
  d.dock.hide();
  d.hiddenDock.show();
  d.run("restore");
  assert.equal(d.dock.visible, false);
  assert.equal(d.hiddenDock.visible, true);
});

test("missing Dock APIs fail before changing the panel", () => {
  const d = desktop();
  delete d.docks[1]._intellihide.forceUpdate;
  assert.throws(() => d.run("hide"), /Dock/i);
  assert.equal(d.panel.visible, true);
  assert.equal(d.context.global._transplayerDesktop, undefined);
});

test("restore returns each original visibility and removes visibility guards", () => {
  const d = desktop();
  d.run("hide");
  assert.equal(d.run("restore"), true);
  assert.equal(d.panel.visible, true);
  assert.equal(d.dock.visible, true);
  assert.equal(d.hiddenDock.visible, false);
  assert.equal(d.panel.listeners.size, 0);
  assert.equal(d.context.global._transplayerDesktop, undefined);
  d.docks.forEach((dock, i) => assert.equal(dock._intellihide._handledWindow, d.originals[i]));
  assert.equal(d.dock.listeners.size, 0);
  d.docks.forEach((dock, i) => {
    assert.equal(dock._intellihide._handledWindow, d.originals[i]);
    assert.equal(dock._intellihide.updates, 2);
  });
  assert.equal(d.run("restore"), true);
});

test("another instance cannot overwrite or restore a live snapshot", () => {
  const d = desktop();
  d.run("hide");
  assert.throws(() => d.run("hide", "different-owner"), /already/i);
  assert.throws(() => d.run("restore", "different-owner"), /owner/i);
  assert.equal(d.panel.visible, false);
  d.run("restore");
});

test("partial Dock update failure rolls back the panel and all installed hooks", () => {
  const d = desktop();
  let first = true;
  d.docks[1]._intellihide.forceUpdate = () => {
    if (first) { first = false; throw new Error("synthetic update failure"); }
  };
  assert.throws(() => d.run("hide"), /synthetic/);
  assert.equal(d.panel.visible, true);
  assert.equal(d.panel.listeners.size, 0);
  assert.equal(d.context.global._transplayerDesktop, undefined);
  d.docks.forEach((dock, i) => assert.equal(dock._intellihide._handledWindow, d.originals[i]));
});

test("script arguments cannot inject code into the desktop session", () => {
  assert.throws(() => desktopScript("hide", '\");bad();("', 1234), /owner/i);
  assert.throws(() => desktopScript("arbitrary", "test-owner", 1234), /action/i);
  for (const pid of [undefined, 0, -1, 1.5, "1234);bad()", Infinity]) {
    assert.throws(() => desktopScript("hide", "test-owner", pid), /pid/i);
  }
});
