import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, shell, Tray } from "electron";
import electronUpdater from "electron-updater";

import { createDiscordPresenceController, loadBridgeConfig } from "../../scripts/discord-presence-bridge-core.mjs";
import { proxyYoutubeMusicHttpRequest } from "../../server/youtubeMusicProxy.js";
import { resolveDesktopDiscordConfig } from "./discord-config.mjs";
import {
  buildDesktopProxyTargetUrl,
  getDesktopBackendOrigin,
  shouldHandleDesktopRequestLocally,
  shouldProxyDesktopRequestPath,
} from "./server-routing.mjs";

const { autoUpdater } = electronUpdater;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const distRoot = path.join(projectRoot, "dist");
const desktopPort = Number.parseInt(process.env.KNOBB_DESKTOP_PORT || "32146", 10) || 32146;
const defaultUpdateCheckIntervalHours = 4;
const requiredUpdateGracePeriodMs = 3 * 24 * 60 * 60 * 1000;
const updateStateFileName = "desktop-update-state.json";
const supportedUpdatePlatforms = new Set(["darwin", "win32"]);
const desktopAppEntryPath = "/app";
const desktopAuthCallbackPath = "/auth";
const repoOwner = "MunasibApurbo";
const repoName = "knobb-desktop";
const repoUrl = `https://github.com/${repoOwner}/${repoName}`;
const releasesUrl = `${repoUrl}/releases/latest`;
const appIcon = process.platform === "darwin"
  ? path.join(projectRoot, "desktop", "knobb", "assets", "knobb.icns")
  : path.join(projectRoot, "public", "brand", "logo-k-black-square-512.png");
const proxyRequestHeaderAllowlist = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "cache-control",
  "content-length",
  "content-type",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
  "range",
  "user-agent",
]);
const hopByHopResponseHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

let discordController = null;
let discordUnsubscribe = null;
let localServer = null;
let mainWindow = null;
let launchTarget = null;
let tray = null;
let isQuitting = false;
let manualUpdateCheckPending = false;
let updateCheckTimer = null;
let desktopAuthSessionActive = false;
let persistedUpdateState = {
  lastSuccessfulCheckAt: null,
};
let updaterState = {
  supported: false,
  configured: false,
  currentVersion: "0.0.0",
  feedURL: null,
  checkOnLaunch: true,
  checkIntervalHours: defaultUpdateCheckIntervalHours,
  status: "disabled",
  lastCheckedAt: null,
  lastSuccessfulCheckAt: null,
  required: false,
  blockingReason: null,
  downloadProgress: null,
  updateInfo: null,
  lastError: null,
};

function getTrayIcon() {
  const size = process.platform === "darwin" ? 18 : 32;
  return nativeImage.createFromPath(appIcon).resize({ width: size, height: size });
}

function getLaunchTargetSnapshot() {
  if (!launchTarget) {
    return null;
  }

  return {
    mode: launchTarget.mode,
    url: launchTarget.url,
    error: launchTarget.error,
  };
}

function resolveDesktopEntryUrl(baseUrl) {
  const resolvedUrl = new URL(baseUrl);
  if (!resolvedUrl.pathname || resolvedUrl.pathname === "/") {
    resolvedUrl.pathname = desktopAppEntryPath;
  }
  return resolvedUrl.toString();
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

async function readJsonIfPresent(filePath) {
  const source = await readFileIfPresent(filePath);
  if (!source) {
    return null;
  }

  return JSON.parse(source.toString("utf8"));
}

async function loadDesktopDiscordConfig() {
  const bundledConfig = await loadBridgeConfig(projectRoot);
  if (!app.isPackaged) {
    return bundledConfig;
  }

  const userConfig = await loadBridgeConfig(app.getPath("userData"));
  return resolveDesktopDiscordConfig(bundledConfig, userConfig);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();

  if (process.platform === "darwin") {
    app.dock.show();
  }
}

function hideMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.hide();

  if (process.platform === "darwin") {
    app.dock.hide();
  }
}

function getMimeType(filePath) {
  return mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function isHashedAsset(filePath) {
  return /assets\/.+-[A-Za-z0-9_-]{8,}\./.test(filePath);
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? "Hide Knobb" : "Show Knobb",
      click: () => {
        if (mainWindow?.isVisible()) {
          hideMainWindow();
          return;
        }

        showMainWindow();
      },
    },
    {
      label: "Open Website",
      click: () => {
        const target = discordController?.config?.siteUrl || launchTarget?.url;
        if (target) {
          void shell.openExternal(target);
        }
      },
    },
    {
      label: "View Latest Release",
      click: () => {
        void shell.openExternal(releasesUrl);
      },
    },
    {
      label: "Open Desktop Repo",
      click: () => {
        void shell.openExternal(repoUrl);
      },
    },
    ...getUpdateMenuItems(),
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function updateTray() {
  if (!tray) {
    return;
  }

  const status = discordController?.getStatus();
  const currentActivity = status?.currentActivity;
  const trayTitle = currentActivity
    ? `${currentActivity.details} - ${currentActivity.state}`
    : "Knobb Desktop";

  tray.setToolTip(trayTitle);
  tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  if (tray) {
    return tray;
  }

  tray = new Tray(getTrayIcon());
  tray.setToolTip("Knobb Desktop");
  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
      hideMainWindow();
      return;
    }

    showMainWindow();
  });
  tray.on("double-click", showMainWindow);

  updateTray();
  return tray;
}

function buildErrorPage(title, detail) {
  const escapedTitle = String(title)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const escapedDetail = String(detail)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Knobb Desktop</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #1c1c1c 0%, #090909 55%, #040404 100%);
        color: #f5f5f5;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      main {
        width: min(640px, calc(100vw - 48px));
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(10, 10, 10, 0.9);
        padding: 24px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
      }
      h1 { margin: 0 0 12px; font-size: 20px; }
      p { margin: 0 0 16px; color: rgba(255, 255, 255, 0.72); line-height: 1.5; }
      pre {
        margin: 0;
        padding: 14px;
        overflow: auto;
        white-space: pre-wrap;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        color: #ffd0d0;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapedTitle}</h1>
      <p>Knobb Desktop could not load the app shell.</p>
      <pre>${escapedDetail}</pre>
    </main>
  </body>
</html>`;
}

function isDesktopAuthCallbackRequest(requestUrl) {
  return requestUrl.pathname === desktopAuthCallbackPath && [
    "code",
    "error",
    "error_code",
    "error_description",
  ].some((key) => requestUrl.searchParams.has(key));
}

function buildDesktopAuthCallbackPage(didReturnToApp) {
  const title = didReturnToApp ? "Sign-in complete" : "Return to Knobb Desktop";
  const detail = didReturnToApp
    ? "You can close this browser tab. Knobb Desktop is finishing the sign-in flow."
    : "Knobb Desktop could not be reached automatically. Reopen the app and try the sign-in again.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #1c1c1c 0%, #090909 55%, #040404 100%);
        color: #f5f5f5;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      main {
        width: min(520px, calc(100vw - 48px));
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(10, 10, 10, 0.9);
        padding: 24px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
      }
      h1 { margin: 0 0 12px; font-size: 20px; }
      p { margin: 0; color: rgba(255, 255, 255, 0.72); line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${detail}</p>
    </main>
  </body>
</html>`;
}

function getDesktopBackendProxyOrigin() {
  return getDesktopBackendOrigin({
    envSiteUrl: process.env.KNOBB_SITE_URL || process.env.VITE_SITE_URL || null,
    configuredSiteUrl: discordController?.config?.siteUrl || null,
  });
}

async function readProxyRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function buildProxyRequestHeaders(headers) {
  const nextHeaders = new Headers();

  for (const [name, value] of Object.entries(headers || {})) {
    if (!proxyRequestHeaderAllowlist.has(name.toLowerCase())) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) {
          nextHeaders.append(name, item);
        }
      }
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      nextHeaders.set(name, value);
    }
  }

  return nextHeaders;
}

async function proxyDesktopRequest(req, res, requestUrl) {
  const backendOrigin = getDesktopBackendProxyOrigin();
  const targetUrl = buildDesktopProxyTargetUrl(requestUrl, backendOrigin);
  if (!targetUrl) {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Desktop backend origin is not configured");
    return;
  }

  const method = String(req.method || "GET").toUpperCase();
  const requestHeaders = buildProxyRequestHeaders(req.headers);
  const body = method === "GET" || method === "HEAD"
    ? undefined
    : await readProxyRequestBody(req);

  const upstream = await fetch(targetUrl, {
    method,
    headers: requestHeaders,
    redirect: "manual",
    ...(body ? { body } : {}),
  });

  const responseHeaders = {};
  upstream.headers.forEach((value, name) => {
    if (hopByHopResponseHeaders.has(name.toLowerCase())) {
      return;
    }

    responseHeaders[name] = value;
  });

  res.writeHead(upstream.status, responseHeaders);

  if (!upstream.body || method === "HEAD") {
    res.end();
    return;
  }

  await pipeline(Readable.fromWeb(upstream.body), res);
}

async function startStaticServer() {
  const indexPath = path.join(distRoot, "index.html");
  if (!(await readFileIfPresent(indexPath))) {
    return {
      server: null,
      url: null,
      error: "Build output is missing. Run `npm run build` or launch with KNOBB_DESKTOP_URL pointed at a dev server.",
    };
  }

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || "/", `http://127.0.0.1:${desktopPort}`);
      if (desktopAuthSessionActive && isDesktopAuthCallbackRequest(requestUrl)) {
        const callbackTargetUrl = launchTarget?.url
          ? new URL(`${requestUrl.pathname}${requestUrl.search}`, launchTarget.url).toString()
          : null;

        desktopAuthSessionActive = false;

        if (callbackTargetUrl && mainWindow && !mainWindow.isDestroyed()) {
          await mainWindow.loadURL(callbackTargetUrl);
          showMainWindow();
        }

        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(buildDesktopAuthCallbackPage(Boolean(callbackTargetUrl)));
        return;
      }

      if (shouldProxyDesktopRequestPath(requestUrl.pathname)) {
        if (shouldHandleDesktopRequestLocally(requestUrl.pathname)) {
          await proxyYoutubeMusicHttpRequest(req, res);
          return;
        }
        await proxyDesktopRequest(req, res, requestUrl);
        return;
      }

      let relativePath = decodeURIComponent(requestUrl.pathname);
      if (relativePath === "/") {
        relativePath = "/index.html";
      }

      const normalizedPath = path.posix.normalize(relativePath);
      if (normalizedPath.includes("..")) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      const resolvedFile = path.join(distRoot, normalizedPath);
      const candidate = await readFileIfPresent(resolvedFile);
      const shouldServeIndex = candidate === null && path.extname(normalizedPath) === "";
      const body = shouldServeIndex ? await readFileIfPresent(indexPath) : candidate;

      if (body === null) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      const targetPath = shouldServeIndex ? indexPath : resolvedFile;
      res.writeHead(200, {
        "Content-Type": getMimeType(targetPath),
        "Cache-Control": shouldServeIndex || targetPath.endsWith("/sw.js")
          ? "no-cache"
          : isHashedAsset(targetPath)
            ? "public, max-age=31536000, immutable"
            : "public, max-age=3600",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(desktopPort, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  return {
    server,
    url: resolveDesktopEntryUrl(`http://127.0.0.1:${desktopPort}`),
    error: null,
  };
}

async function resolveLaunchTarget() {
  const devUrl = String(process.env.KNOBB_DESKTOP_URL || "").trim();
  if (devUrl) {
    return {
      mode: "dev-server",
      url: resolveDesktopEntryUrl(devUrl),
      error: null,
      server: null,
    };
  }

  const local = await startStaticServer();
  if (!local.url) {
    return {
      mode: "build-missing",
      url: null,
      error: local.error,
      server: local.server,
    };
  }

  return {
    mode: "bundled-build",
    url: local.url,
    error: null,
    server: local.server,
  };
}

function isAppUrl(targetUrl) {
  if (!launchTarget?.url) {
    return false;
  }

  try {
    return new URL(targetUrl).origin === new URL(launchTarget.url).origin;
  } catch {
    return false;
  }
}

function isHttpNavigation(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function shouldAllowInAppNavigation(targetUrl) {
  return isAppUrl(targetUrl) || (desktopAuthSessionActive && isHttpNavigation(targetUrl));
}

function sendDiscordStatus() {
  if (!mainWindow || mainWindow.isDestroyed() || !discordController) {
    return;
  }

  mainWindow.webContents.send("discord:status", discordController.getStatus());
  updateTray();
}

function enforceWindowScale(window) {
  const resetScale = () => {
    if (window.isDestroyed()) {
      return;
    }

    window.webContents.setZoomFactor(1);
    window.webContents.setZoomLevel(0);
  };

  void window.webContents.setVisualZoomLevelLimits(1, 1);
  resetScale();

  window.webContents.on("did-finish-load", resetScale);
  window.webContents.on("zoom-changed", resetScale);
}

function getDesktopUpdateStatePath() {
  return path.join(app.getPath("userData"), updateStateFileName);
}

async function loadPersistedUpdateState() {
  const nextState = await readJsonIfPresent(getDesktopUpdateStatePath());
  persistedUpdateState = {
    lastSuccessfulCheckAt: typeof nextState?.lastSuccessfulCheckAt === "string"
      ? nextState.lastSuccessfulCheckAt
      : null,
  };
}

async function writePersistedUpdateState() {
  await fs.mkdir(path.dirname(getDesktopUpdateStatePath()), { recursive: true });
  await fs.writeFile(getDesktopUpdateStatePath(), `${JSON.stringify(persistedUpdateState, null, 2)}\n`);
}

function isWithinUpdateGraceWindow(referenceDate = Date.now()) {
  const lastSuccessfulCheckAt = persistedUpdateState.lastSuccessfulCheckAt;
  if (!lastSuccessfulCheckAt) {
    return false;
  }

  const parsed = Date.parse(lastSuccessfulCheckAt);
  if (Number.isNaN(parsed)) {
    return false;
  }

  return referenceDate - parsed <= requiredUpdateGracePeriodMs;
}

async function rememberSuccessfulUpdateCheck(timestamp = new Date().toISOString()) {
  persistedUpdateState = {
    ...persistedUpdateState,
    lastSuccessfulCheckAt: timestamp,
  };
  await writePersistedUpdateState();
  pushUpdateStatus({
    lastSuccessfulCheckAt: timestamp,
    blockingReason: updaterState.required ? "update-required" : null,
  });
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
    updateTray();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop:update-status", getUpdateStatusSnapshot());
  }
}

function getUpdateMenuItems() {
  return [
    {
      label: "Check for Updates",
      click: () => {
        void checkForAppUpdates({ manual: true });
      },
    },
    {
      label: updaterState.status === "downloaded"
        ? "Restart to Update"
        : updaterState.required
          ? "Update Required"
          : "Restart to Update",
      enabled: updaterState.status === "downloaded",
      click: () => {
        void installDownloadedUpdate();
      },
    },
    { type: "separator" },
  ];
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
    return { response: 0 };
  }

  return dialog.showMessageBox(mainWindow, options);
}

async function installDownloadedUpdate() {
  if (updaterState.status !== "downloaded") {
    return false;
  }

  isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
  return true;
}

async function promptToInstallUpdate(updateInfo) {
  const { response } = await showUpdateMessageBox({
    type: "info",
    buttons: ["Restart and Update"],
    defaultId: 0,
    cancelId: 0,
    title: "Required Update Ready",
    message: `Knobb Desktop ${updateInfo.releaseName || ""}`.trim(),
    detail: "A required update has been downloaded and must be installed before you continue.",
  });

  if (response === 0) {
    await installDownloadedUpdate();
  }
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

async function checkForAppUpdates({ manual = false } = {}) {
  if (!updaterState.supported) {
    if (manual) {
      await showUpdateMessageBox({
        type: "info",
        buttons: ["OK"],
        defaultId: 0,
        title: "Updates Unavailable",
        message: "Updates are only supported by packaged macOS and Windows desktop builds.",
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
        message: "Knobb Desktop could not locate its bundled update configuration.",
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
        message: "Knobb Desktop is already checking for updates.",
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
    blockingReason: updaterState.required ? "update-required" : updaterState.blockingReason,
  });

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    const blockingReason = updaterState.required
      ? "update-required"
      : isWithinUpdateGraceWindow()
        ? null
        : "offline-grace-expired";
    pushUpdateStatus({
      status: "error",
      lastError: error instanceof Error ? error.message : String(error),
      blockingReason,
      required: updaterState.required,
    });
    showManualUpdateResult({
      title: "Update Check Failed",
      detail: blockingReason === "offline-grace-expired"
        ? "Knobb Desktop must reconnect to verify required updates before it can continue."
        : error instanceof Error
          ? error.message
          : String(error),
      type: "error",
    });
  }

  return getUpdateStatusSnapshot();
}

async function configureAutoUpdates() {
  await loadPersistedUpdateState();
  const supported = supportedUpdatePlatforms.has(process.platform) && app.isPackaged;
  const configured = supported;
  const initialBlockingReason = configured && !isWithinUpdateGraceWindow()
    ? "offline-grace-expired"
    : null;

  pushUpdateStatus({
    supported,
    configured,
    currentVersion: app.getVersion(),
    feedURL: null,
    checkOnLaunch: true,
    checkIntervalHours: defaultUpdateCheckIntervalHours,
    status: configured ? "idle" : supported ? "not-configured" : "disabled",
    lastSuccessfulCheckAt: persistedUpdateState.lastSuccessfulCheckAt,
    required: false,
    blockingReason: initialBlockingReason,
    downloadProgress: null,
    lastError: null,
  });

  if (!configured) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.disableWebInstaller = true;

  autoUpdater.on("error", (error) => {
    const blockingReason = updaterState.required
      ? "update-required"
      : isWithinUpdateGraceWindow()
        ? null
        : "offline-grace-expired";
    pushUpdateStatus({
      status: "error",
      lastError: error instanceof Error ? error.message : String(error),
      blockingReason,
    });
    showManualUpdateResult({
      title: "Update Check Failed",
      detail: blockingReason === "offline-grace-expired"
        ? "Knobb Desktop must reconnect to verify updates before it can continue."
        : error instanceof Error
          ? error.message
          : String(error),
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
    const checkedAt = new Date().toISOString();
    void rememberSuccessfulUpdateCheck(checkedAt);
    pushUpdateStatus({
      status: "downloading",
      updateInfo: normalizeUpdateInfo(info),
      lastError: null,
      required: true,
      blockingReason: "update-required",
      downloadProgress: 0,
    });
    showManualUpdateResult({
      title: "Required Update Found",
      detail: "Knobb Desktop found a required update and is downloading it now.",
    });
  });

  autoUpdater.on("update-not-available", () => {
    const checkedAt = new Date().toISOString();
    void rememberSuccessfulUpdateCheck(checkedAt);
    pushUpdateStatus({
      status: "idle",
      updateInfo: null,
      lastError: null,
      required: false,
      blockingReason: null,
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
      required: true,
      blockingReason: "update-required",
      downloadProgress: Number.isFinite(info?.percent) ? Math.max(0, Math.min(100, info.percent)) : null,
    });
  });

  autoUpdater.on("update-downloaded", (event) => {
    const updateInfo = normalizeUpdateInfo(event);
    pushUpdateStatus({
      status: "downloaded",
      updateInfo,
      lastError: null,
      required: true,
      blockingReason: "update-required",
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
  }, defaultUpdateCheckIntervalHours * 60 * 60 * 1000);
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    autoHideMenuBar: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#050505" : "#101010",
    title: "Knobb Desktop",
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  enforceWindowScale(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldAllowInAppNavigation(url)) {
      return { action: "allow" };
    }

    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (shouldAllowInAppNavigation(url)) {
      return;
    }

    event.preventDefault();
    void shell.openExternal(url);
  });

  mainWindow.webContents.on("did-navigate", (_event, url) => {
    if (desktopAuthSessionActive && isAppUrl(url)) {
      desktopAuthSessionActive = false;
    }
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    hideMainWindow();
  });

  mainWindow.once("ready-to-show", showMainWindow);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (launchTarget?.url) {
    await mainWindow.loadURL(launchTarget.url);
  } else {
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildErrorPage(
      "Knobb Desktop requires a build",
      launchTarget?.error || "Unknown startup error",
    ))}`);
  }

  if (!app.isPackaged && process.env.KNOBB_DESKTOP_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Knobb",
      submenu: [
        {
          label: "Show Knobb",
          click: showMainWindow,
        },
        {
          label: "Hide Knobb",
          click: hideMainWindow,
        },
        { type: "separator" },
        {
          label: "Open Website",
          click: () => {
            const target = discordController?.config?.siteUrl || launchTarget?.url;
            if (target) {
              void shell.openExternal(target);
            }
          },
        },
        {
          label: "View Latest Release",
          click: () => {
            void shell.openExternal(releasesUrl);
          },
        },
        {
          label: "Open Desktop Repo",
          click: () => {
            void shell.openExternal(repoUrl);
          },
        },
        ...getUpdateMenuItems(),
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { role: "togglefullscreen" },
        { role: "close" },
      ],
    },
  ]);
}

app.setName("Knobb Desktop");
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", showMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Keep background integrations alive in the tray until the user explicitly quits.
  }
});

app.on("activate", () => {
  if (!mainWindow) {
    void createMainWindow().then(() => {
      sendDiscordStatus();
      updateTray();
    });
    return;
  }

  showMainWindow();
});

app.whenReady()
  .then(async () => {
    const config = await loadDesktopDiscordConfig();
    discordController = await createDiscordPresenceController({ config });
    await discordController.start();
    await configureAutoUpdates();
    discordUnsubscribe = discordController.subscribe(() => {
      sendDiscordStatus();
    });

    launchTarget = await resolveLaunchTarget();
    localServer = launchTarget?.server || null;

    ipcMain.handle("discord:get-status", async () => discordController?.getStatus() || null);
    ipcMain.handle("discord:set-activity", async (_event, activity) => {
      await discordController?.setActivity(activity);
      return discordController?.getStatus() || null;
    });
    ipcMain.handle("discord:clear-activity", async () => {
      await discordController?.clearActivity();
      return discordController?.getStatus() || null;
    });
    ipcMain.handle("desktop:get-launch-target", async () => getLaunchTargetSnapshot());
    ipcMain.handle("desktop:get-update-status", async () => getUpdateStatusSnapshot());
    ipcMain.handle("desktop:check-for-updates", async () => checkForAppUpdates({ manual: true }));
    ipcMain.handle("desktop:quit-and-install-update", async () => installDownloadedUpdate());
    ipcMain.handle("desktop:begin-auth-session", async () => {
      desktopAuthSessionActive = true;
      return true;
    });
    ipcMain.handle("desktop:open-external", async (_event, url) => {
      const target = String(url || "").trim();
      if (!target) {
        return false;
      }

      await shell.openExternal(target);
      return true;
    });
    ipcMain.handle("desktop:show-window", async () => {
      showMainWindow();
      return true;
    });
    ipcMain.handle("desktop:hide-window", async () => {
      hideMainWindow();
      return true;
    });
    ipcMain.handle("desktop:quit", async () => {
      isQuitting = true;
      app.quit();
      return true;
    });

    Menu.setApplicationMenu(buildMenu());
    createTray();
    await createMainWindow();
    sendDiscordStatus();
    updateTray();
  })
  .catch((error) => {
    console.error("Failed to launch Knobb Desktop", error);
    app.exit(1);
  });

app.on("before-quit", () => {
  isQuitting = true;
  discordUnsubscribe?.();
});

app.on("quit", () => {
  if (discordController) {
    void discordController.close();
  }

  if (localServer) {
    localServer.close();
  }

  if (tray) {
    tray.destroy();
    tray = null;
  }

  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
});
