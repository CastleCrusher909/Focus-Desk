const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("focusApi", {
  startBlocking: (sites) => ipcRenderer.invoke("blocker-start", sites),
  stopBlocking: () => ipcRenderer.invoke("blocker-stop"),
  showBlockingHelp: () => ipcRenderer.invoke("blocker-help"),
  startAppBlocking: (apps) => ipcRenderer.invoke("appblocker-start", apps),
  stopAppBlocking: () => ipcRenderer.invoke("appblocker-stop"),
  listInstalledApps: () => ipcRenderer.invoke("apps-list"),
  siteSuggest: (query) => ipcRenderer.invoke("site-suggest", query)
});
