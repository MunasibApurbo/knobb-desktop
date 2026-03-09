import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("knobbDiscordCompanion", {
  getStatus: () => ipcRenderer.invoke("bridge:get-status"),
  getUpdateStatus: () => ipcRenderer.invoke("bridge:get-update-status"),
  checkForUpdates: () => ipcRenderer.invoke("bridge:check-for-updates"),
  installUpdate: () => ipcRenderer.invoke("bridge:install-update"),
  openKnobb: () => ipcRenderer.invoke("bridge:open-knobb"),
  openRelease: () => ipcRenderer.invoke("bridge:open-release"),
  openRepo: () => ipcRenderer.invoke("bridge:open-repo"),
  openConfigDirectory: () => ipcRenderer.invoke("bridge:open-config-directory"),
  onStatus(listener) {
    const wrapped = (_event, payload) => {
      listener(payload);
    };

    ipcRenderer.on("bridge-status", wrapped);
    return () => {
      ipcRenderer.removeListener("bridge-status", wrapped);
    };
  },
  onUpdateStatus(listener) {
    const wrapped = (_event, payload) => {
      listener(payload);
    };

    ipcRenderer.on("bridge-update-status", wrapped);
    return () => {
      ipcRenderer.removeListener("bridge-update-status", wrapped);
    };
  },
});
