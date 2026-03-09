import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, Menu, ipcMain, nativeTheme, shell } from "electron";

import { createBridgeService, loadBridgeConfig } from "../../scripts/discord-presence-bridge-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let bridgeService = null;
let bridgeUnsubscribe = null;
let mainWindow = null;

function getKnobbUrl() {
  const status = bridgeService?.getStatus();
  return status?.currentActivity?.sourceUrl || bridgeService?.config?.siteUrl || "http://127.0.0.1:8080";
}

function sendBridgeStatus() {
  if (!mainWindow || mainWindow.isDestroyed() || !bridgeService) return;
  const status = bridgeService.getStatus();
  mainWindow.webContents.send("bridge-status", status);
  if (!status.configured) {
    mainWindow.setTitle("Knobb Discord Companion - Setup required");
    return;
  }
  mainWindow.setTitle(
    status.discordConnected
      ? "Knobb Discord Companion - Connected"
      : "Knobb Discord Companion - Waiting for Discord",
  );
}

function enforceWindowScale(window) {
  const resetScale = () => {
    if (window.isDestroyed()) return;
    window.webContents.setZoomFactor(1);
    window.webContents.setZoomLevel(0);
  };

  void window.webContents.setVisualZoomLevelLimits(1, 1);
  resetScale();

  window.webContents.on("did-finish-load", resetScale);
  window.webContents.on("zoom-changed", resetScale);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 520,
    minWidth: 460,
    minHeight: 460,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#090909" : "#111111",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  enforceWindowScale(mainWindow);

  void mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.setName("Knobb Discord Companion");
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!mainWindow) {
    createMainWindow();
    sendBridgeStatus();
  }
});

app.whenReady()
  .then(async () => {
    const config = await loadBridgeConfig(process.cwd());
    bridgeService = await createBridgeService({ config });
    await bridgeService.start();
    bridgeUnsubscribe = bridgeService.subscribe(() => {
      sendBridgeStatus();
    });

    ipcMain.handle("bridge:get-status", async () => bridgeService?.getStatus() || null);
    ipcMain.handle("bridge:open-knobb", async () => {
      await shell.openExternal(getKnobbUrl());
      return true;
    });

    createMainWindow();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: "Knobb Companion",
        submenu: [
          {
            label: "Open Knobb",
            click: () => {
              void shell.openExternal(getKnobbUrl());
            },
          },
          {
            label: "Refresh Status",
            click: () => {
              sendBridgeStatus();
            },
          },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "Window",
        submenu: [
          { role: "minimize" },
          { role: "close" },
        ],
      },
    ]));
  })
  .catch((error) => {
    console.error("Failed to launch Knobb Discord Companion", error);
    app.exit(1);
  });

app.on("before-quit", () => {
  bridgeUnsubscribe?.();
});

app.on("quit", () => {
  if (bridgeService) {
    void bridgeService.close();
  }
});
