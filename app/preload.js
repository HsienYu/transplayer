const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("transplayer", {
  config: () => ipcRenderer.invoke("playback-config"),
  report: status => ipcRenderer.send("playback-status", status),
});
