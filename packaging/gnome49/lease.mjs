export const RELEASES = Object.freeze(["r8", "r9"].map(version => Object.freeze({
  version,
  executable: `/opt/transplayer/releases/${version}.AppDir/runtime/electron`,
  appDir: `/opt/transplayer/releases/${version}.AppDir/app`,
})));

export class DesktopLease {
  constructor(options) {
    Object.assign(this, options);
    this.snapshot = null;
  }

  acquire(sender, pid, owner, chain) {
    if (!/^:\d+\.\d+$/.test(sender) || !Number.isSafeInteger(pid) || pid <= 0 ||
        typeof owner !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(owner)) {
      throw new Error("Invalid desktop lease arguments");
    }
    if (this.snapshot) throw new Error("Desktop already owned");
    const [client, guard, player] = chain || [];
    const targets = this.targets || [{ executable: this.executable, appDir: this.appDir }];
    const target = targets.find(t => t.executable === guard?.exe && t.executable === player?.exe);
    // Electron45 rewrites its Linux argv into this exact single process title.
    const title = `${target?.executable} --ozone-platform=x11 --enable-transparent-visuals --disable-setuid-sandbox ${target?.appDir}`;
    const playerArgs = player?.args;
    const playerMatches = playerArgs && (
      (playerArgs[0] === target?.executable && playerArgs[1] === target?.appDir) ||
      (playerArgs[0] === title && playerArgs.slice(1).every(arg => arg === "")));
    if (!target || !client || !guard || !player || chain.length !== 3 ||
        !chain.every(p => Number.isSafeInteger(p.pid) && p.pid > 0 && p.uid === this.uid) ||
        client.ppid !== guard.pid || guard.ppid !== player.pid || player.pid !== pid ||
        !guard.secureExecutable || !player.secureExecutable ||
        guard.args[1] !== `${target.appDir}/desktop-modern-guard.js` ||
        !playerMatches) {
      throw new Error("Desktop process identity mismatch");
    }
    const docks = this.getDocks ? this.getDocks() : this.docks;
    if (!Array.isArray(docks) || !docks.length || docks.some(d => !d._intellihide ||
        typeof d._intellihide._handledWindow !== "function" ||
        typeof d._intellihide.forceUpdate !== "function")) {
      throw new Error("Unsupported Ubuntu Dock API");
    }
    const s = { sender, owner, visible: this.panel.visible, signal: 0, hooks: [] };
    this.snapshot = s;
    try {
      s.signal = this.panel.connect("notify::visible", () => this.panel.hide());
      this.panel.hide();
      for (const dock of docks) {
        const target = dock._intellihide;
        const original = target._handledWindow;
        const wrapper = function(actor) {
          const window = actor.get_meta_window();
          if (window && window.get_pid() === pid) return false;
          return original.call(this, actor);
        };
        s.hooks.push({ target, original, wrapper,
          own: Object.prototype.hasOwnProperty.call(target, "_handledWindow") });
        target._handledWindow = wrapper;
        target.forceUpdate();
      }
    } catch (error) {
      this.restore();
      throw error;
    }
  }

  release(sender, owner) {
    if (!this.snapshot) return;
    if (this.snapshot.sender !== sender || this.snapshot.owner !== owner) {
      throw new Error("Desktop owner mismatch");
    }
    this.restore();
  }

  disconnect(sender) {
    if (this.snapshot && this.snapshot.sender === sender) this.restore();
  }

  disable() { this.restore(); }

  restore() {
    const s = this.snapshot;
    if (!s) return;
    let failure;
    const attempt = fn => { try { fn(); } catch (e) { failure = failure || e; } };
    attempt(() => { if (s.signal) this.panel.disconnect(s.signal); });
    attempt(() => { this.panel.visible = s.visible; });
    for (const h of s.hooks) attempt(() => {
      if (h.target._handledWindow === h.wrapper) {
        if (h.own) h.target._handledWindow = h.original;
        else delete h.target._handledWindow;
      }
    });
    this.snapshot = null;
    for (const h of s.hooks) attempt(() => h.target.forceUpdate());
    if (failure) throw failure;
  }
}
