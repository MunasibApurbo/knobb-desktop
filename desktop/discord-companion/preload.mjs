import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("knobbDiscordCompanion", {
  getStatus: () => ipcRenderer.invoke("bridge:get-status"),
  openKnobb: () => ipcRenderer.invoke("bridge:open-knobb"),
  onStatus(listener) {
    const wrapped = (_event, payload) => {
      listener(payload);
    };

    ipcRenderer.on("bridge-status", wrapped);
    return () => {
      ipcRenderer.removeListener("bridge-status", wrapped);
    };
  },
});
