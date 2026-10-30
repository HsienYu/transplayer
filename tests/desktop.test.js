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
  const context = vm.createContext({
    global: {},
    imports: {
      ui: { main: { panel: { actor: panel } } },
      misc: { extensionUtils: { extensions: {
        "ubuntu-dock@ubuntu.com": { imports: { extension: {
          dockManager: { _allDocks: [{ actor: dock }, { actor: hiddenDock }] },
        } } },
      } } },
    },
  });
  return { panel, dock, hiddenDock, context,
    run: (action, owner = "test-owner") => vm.runInContext(desktopScript(action, owner), context) };
}

test("hide suppresses panel and all docks, including later auto-show", () => {
  const d = desktop();
  assert.equal(d.run("hide"), true);
  assert.equal(d.panel.visible, false);
  assert.equal(d.dock.visible, false);
  d.dock.show();
  assert.equal(d.dock.visible, false);
});

test("restore returns each original visibility and removes visibility guards", () => {
  const d = desktop();
  d.run("hide");
  assert.equal(d.run("restore"), true);
  assert.equal(d.panel.visible, true);
  assert.equal(d.dock.visible, true);
  assert.equal(d.hiddenDock.visible, false);
  assert.equal(d.panel.listeners.size, 0);
  assert.equal(d.dock.listeners.size, 0);
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

test("partial failure restores actors already hidden", () => {
  const d = desktop();
  d.dock.hide = () => { throw new Error("synthetic actor failure"); };
  assert.throws(() => d.run("hide"), /synthetic/);
  assert.equal(d.panel.visible, true);
  assert.equal(d.panel.listeners.size, 0);
});

test("script arguments cannot inject code into the desktop session", () => {
  assert.throws(() => desktopScript("hide", '");bad();("'), /owner/i);
  assert.throws(() => desktopScript("arbitrary", "test-owner"), /action/i);
});
