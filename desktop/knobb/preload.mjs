import process from "node:process";

import { contextBridge, ipcRenderer } from "electron";

let latestStatus = null;

const discordBridge = {
  isAvailable: () => Boolean(latestStatus?.ok && latestStatus?.configured),
  async setActivity(activity) {
    await ipcRenderer.invoke("discord:set-activity", activity);
  },
  async clearActivity() {
    await ipcRenderer.invoke("discord:clear-activity");
  },
  async getStatus() {
    const status = await ipcRenderer.invoke("discord:get-status");
    latestStatus = status;
    return status;
  },
  onStatus(listener) {
    const wrapped = (_event, status) => {
      latestStatus = status;
      listener(status);
    };

    ipcRenderer.on("discord:status", wrapped);
    return () => {
      ipcRenderer.removeListener("discord:status", wrapped);
    };
  },
};

contextBridge.exposeInMainWorld("__KNOBB_DISCORD_RPC__", discordBridge);
contextBridge.exposeInMainWorld("knobbDesktop", {
  isDesktopApp: true,
  platform: process.platform,
  getLaunchTarget: () => ipcRenderer.invoke("desktop:get-launch-target"),
  getUpdateStatus: () => ipcRenderer.invoke("desktop:get-update-status"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  quitAndInstallUpdate: () => ipcRenderer.invoke("desktop:quit-and-install-update"),
  beginAuthSession: () => ipcRenderer.invoke("desktop:begin-auth-session"),
  onUpdateStatus(listener) {
    const wrapped = (_event, status) => {
      listener(status);
    };

    ipcRenderer.on("desktop:update-status", wrapped);
    return () => {
      ipcRenderer.removeListener("desktop:update-status", wrapped);
    };
  },
  openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
  showWindow: () => ipcRenderer.invoke("desktop:show-window"),
  hideWindow: () => ipcRenderer.invoke("desktop:hide-window"),
  quit: () => ipcRenderer.invoke("desktop:quit"),
});
