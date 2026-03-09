import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, dialog, Menu, ipcMain, nativeTheme, shell } from "electron";
import electronUpdater from "electron-updater";

import { createBridgeService, loadBridgeConfig } from "../../scripts/discord-presence-bridge-core.mjs";

const { autoUpdater } = electronUpdater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const bridgeConfigFileName = "discord-presence.bridge.json";
const bridgeConfigExampleFileName = "discord-presence.bridge.example.json";
const KNOBB_DESKTOP_RELEASES_URL = "https://github.com/MunasibApurbo/knobb-desktop/releases/latest";
const KNOBB_DESKTOP_REPO_URL = "https://github.com/MunasibApurbo/knobb-desktop";
const COMPANION_UPDATE_CHANNEL = "companion";
const DEFAULT_UPDATE_CHECK_INTERVAL_HOURS = 4;
const SUPPORTED_UPDATE_PLATFORMS = new Set(["darwin", "win32"]);

let bridgeService = null;
let bridgeUnsubscribe = null;
let mainWindow = null;
let manualUpdateCheckPending = false;
let updateCheckTimer = null;
let updaterState = {
  supported: false,
  configured: false,
  channel: COMPANION_UPDATE_CHANNEL,
  currentVersion: "0.0.0",
  status: "disabled",
  lastCheckedAt: null,
  updateInfo: null,
  lastError: null,
  downloadProgress: null,
};

function getCompanionConfigDirectory() {
  return app.isPackaged ? app.getPath("userData") : projectRoot;
}

function getCompanionConfigPath() {
  return path.join(getCompanionConfigDirectory(), bridgeConfigFileName);
}

async function readFileIfPresent(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function ensureCompanionConfigFiles() {
  const configDirectory = getCompanionConfigDirectory();
  await fs.mkdir(configDirectory, { recursive: true });

  const exampleTargetPath = path.join(configDirectory, bridgeConfigExampleFileName);
  const exampleSourcePath = path.join(projectRoot, bridgeConfigExampleFileName);
  const existingExample = await readFileIfPresent(exampleTargetPath);
  if (!existingExample) {
    const exampleSource = await readFileIfPresent(exampleSourcePath);
    if (exampleSource) {
      await fs.writeFile(exampleTargetPath, exampleSource);
    }
  }
}

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

function getUpdateStatusSnapshot() {
  return {
    ...updaterState,
    updateInfo: updaterState.updateInfo ? { ...updaterState.updateInfo } : null,
  };
}

function pushUpdateStatus(patch) {
  updaterState = {
    ...updaterState,
    ...patch,
  };

  if (app.isReady()) {
    Menu.setApplicationMenu(buildMenu());
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bridge-update-status", getUpdateStatusSnapshot());
  }
}

function getUpdateMenuItems() {
  const checkLabel = updaterState.status === "checking"
    ? "Checking for Updates"
    : updaterState.status === "downloading"
      ? "Downloading Update"
      : "Check for Updates";

  return [
    {
      label: checkLabel,
      enabled: updaterState.status !== "checking" && updaterState.status !== "downloading",
      click: () => {
        void checkForAppUpdates({ manual: true });
      },
    },
    {
      label: "Restart to Update",
      enabled: updaterState.status === "downloaded",
      click: () => {
        void installDownloadedUpdate();
      },
    },
    { type: "separator" },
  ];
}

function buildMenu() {
  return Menu.buildFromTemplate([
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
          label: "View Latest Release",
          click: () => {
            void shell.openExternal(KNOBB_DESKTOP_RELEASES_URL);
          },
        },
        {
          label: "Open Desktop Repo",
          click: () => {
            void shell.openExternal(KNOBB_DESKTOP_REPO_URL);
          },
        },
        {
          label: "Open Config Folder",
          click: () => {
            void shell.openPath(getCompanionConfigDirectory());
          },
        },
        {
          label: "Reveal Config File",
          click: () => {
            void shell.showItemInFolder(getCompanionConfigPath());
          },
        },
        {
          label: "Refresh Status",
          click: () => {
            sendBridgeStatus();
          },
        },
        { type: "separator" },
        ...getUpdateMenuItems(),
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
  ]);
}

function normalizeUpdateInfo(payload) {
  const version = String(payload?.version || payload?.releaseName || "").trim() || null;
  const releaseDate = payload?.releaseDate || null;
  const parsedReleaseDate = releaseDate ? new Date(releaseDate) : null;
  const files = Array.isArray(payload?.files) ? payload.files : [];
  const firstFileUrl = typeof files[0]?.url === "string" ? files[0].url : null;
  return {
    version,
    releaseName: String(payload?.releaseName || version || "").trim() || null,
    releaseDate: parsedReleaseDate && !Number.isNaN(parsedReleaseDate.getTime()) ? parsedReleaseDate.toISOString() : null,
    releaseNotes: typeof payload?.releaseNotes === "string"
      ? payload.releaseNotes
      : Array.isArray(payload?.releaseNotes)
        ? payload.releaseNotes.join("\n\n")
        : null,
    updateURL: firstFileUrl,
  };
}

async function showUpdateMessageBox(options) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }

  return await dialog.showMessageBox(mainWindow, options);
}

function showManualUpdateResult({ title, detail, type = "info" }) {
  if (!manualUpdateCheckPending) {
    return;
  }

  manualUpdateCheckPending = false;
  void showUpdateMessageBox({
    type,
    buttons: ["OK"],
    defaultId: 0,
    title,
    message: title,
    detail,
  });
}

async function installDownloadedUpdate() {
  if (updaterState.status !== "downloaded") {
    return false;
  }

  autoUpdater.quitAndInstall(false, true);
  return true;
}

async function promptToInstallUpdate(updateInfo) {
  const result = await showUpdateMessageBox({
    type: "info",
    buttons: ["Restart and Update", "Later"],
    defaultId: 0,
    cancelId: 1,
    title: "Update Ready",
    message: `Knobb Discord Companion ${updateInfo.releaseName || ""}`.trim(),
    detail: "The latest companion update has been downloaded and is ready to install.",
  });

  if (result?.response === 0) {
    await installDownloadedUpdate();
  }
}

async function checkForAppUpdates({ manual = false } = {}) {
  if (!updaterState.supported) {
    if (manual) {
      await showUpdateMessageBox({
        type: "info",
        buttons: ["OK"],
        defaultId: 0,
        title: "Updates Unavailable",
        message: "Updates are only supported by packaged macOS and Windows companion builds.",
      });
    }
    return getUpdateStatusSnapshot();
  }

  if (!updaterState.configured) {
    if (manual) {
      await showUpdateMessageBox({
        type: "warning",
        buttons: ["OK"],
        defaultId: 0,
        title: "Updates Unavailable",
        message: "Knobb Discord Companion could not locate its bundled update configuration.",
        detail: "Rebuild the packaged app with electron-builder so app-update.yml is included.",
      });
    }
    return getUpdateStatusSnapshot();
  }

  if (updaterState.status === "checking") {
    if (manual) {
      await showUpdateMessageBox({
        type: "info",
        buttons: ["OK"],
        defaultId: 0,
        title: "Already Checking",
        message: "Knobb Discord Companion is already checking for updates.",
      });
    }
    return getUpdateStatusSnapshot();
  }

  manualUpdateCheckPending = manual;
  pushUpdateStatus({
    status: "checking",
    lastCheckedAt: new Date().toISOString(),
    lastError: null,
    downloadProgress: null,
  });

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    pushUpdateStatus({
      status: "error",
      lastError: error instanceof Error ? error.message : String(error),
      downloadProgress: null,
    });
    showManualUpdateResult({
      title: "Update Check Failed",
      detail: error instanceof Error ? error.message : String(error),
      type: "error",
    });
  }

  return getUpdateStatusSnapshot();
}

async function configureAutoUpdates() {
  const supported = SUPPORTED_UPDATE_PLATFORMS.has(process.platform) && app.isPackaged;
  const configured = supported;

  pushUpdateStatus({
    supported,
    configured,
    channel: COMPANION_UPDATE_CHANNEL,
    currentVersion: app.getVersion(),
    status: configured ? "idle" : supported ? "not-configured" : "disabled",
    lastCheckedAt: null,
    updateInfo: null,
    lastError: null,
    downloadProgress: null,
  });

  if (!configured) {
    return;
  }

  autoUpdater.channel = COMPANION_UPDATE_CHANNEL;
  autoUpdater.allowDowngrade = false;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.disableWebInstaller = true;

  autoUpdater.on("error", (error) => {
    pushUpdateStatus({
      status: "error",
      lastError: error instanceof Error ? error.message : String(error),
      downloadProgress: null,
    });
    showManualUpdateResult({
      title: "Update Check Failed",
      detail: error instanceof Error ? error.message : String(error),
      type: "error",
    });
  });

  autoUpdater.on("checking-for-update", () => {
    pushUpdateStatus({
      status: "checking",
      lastError: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    pushUpdateStatus({
      status: "downloading",
      updateInfo: normalizeUpdateInfo(info),
      lastError: null,
      downloadProgress: 0,
    });
    showManualUpdateResult({
      title: "Update Found",
      detail: "Knobb Discord Companion found a new release and is downloading it now.",
    });
  });

  autoUpdater.on("update-not-available", () => {
    pushUpdateStatus({
      status: "idle",
      updateInfo: null,
      lastError: null,
      downloadProgress: null,
    });
    showManualUpdateResult({
      title: "No Update Available",
      detail: `You are already running the latest version (${app.getVersion()}).`,
    });
  });

  autoUpdater.on("download-progress", (info) => {
    pushUpdateStatus({
      status: "downloading",
      downloadProgress: Number.isFinite(info?.percent) ? Math.max(0, Math.min(100, info.percent)) : null,
    });
  });

  autoUpdater.on("update-downloaded", (event) => {
    const updateInfo = normalizeUpdateInfo(event);
    pushUpdateStatus({
      status: "downloaded",
      updateInfo,
      lastError: null,
      downloadProgress: 100,
    });
    manualUpdateCheckPending = false;
    void promptToInstallUpdate(updateInfo);
  });

  await checkForAppUpdates();

  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
  }

  updateCheckTimer = setInterval(() => {
    void checkForAppUpdates();
  }, DEFAULT_UPDATE_CHECK_INTERVAL_HOURS * 60 * 60 * 1000);
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
    height: 620,
    minWidth: 460,
    minHeight: 560,
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
    pushUpdateStatus({});
  }
});

app.whenReady()
  .then(async () => {
    await ensureCompanionConfigFiles();
    const config = await loadBridgeConfig(getCompanionConfigDirectory());
    bridgeService = await createBridgeService({ config });
    await bridgeService.start();
    bridgeUnsubscribe = bridgeService.subscribe(() => {
      sendBridgeStatus();
    });

    ipcMain.handle("bridge:get-status", async () => bridgeService?.getStatus() || null);
    ipcMain.handle("bridge:get-update-status", async () => getUpdateStatusSnapshot());
    ipcMain.handle("bridge:check-for-updates", async () => await checkForAppUpdates({ manual: true }));
    ipcMain.handle("bridge:install-update", async () => await installDownloadedUpdate());
    ipcMain.handle("bridge:open-knobb", async () => {
      await shell.openExternal(getKnobbUrl());
      return true;
    });
    ipcMain.handle("bridge:open-release", async () => {
      await shell.openExternal(KNOBB_DESKTOP_RELEASES_URL);
      return true;
    });
    ipcMain.handle("bridge:open-repo", async () => {
      await shell.openExternal(KNOBB_DESKTOP_REPO_URL);
      return true;
    });
    ipcMain.handle("bridge:open-config-directory", async () => {
      await shell.openPath(getCompanionConfigDirectory());
      return true;
    });

    Menu.setApplicationMenu(buildMenu());
    createMainWindow();
    sendBridgeStatus();
    await configureAutoUpdates();
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

  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
});
