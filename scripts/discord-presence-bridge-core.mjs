import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

export const DEFAULT_BRIDGE_PORT = 32145;
export const BRIDGE_VERSION = "1.1.0";
const CLIENT_ID_PLACEHOLDERS = new Set([
  "YOUR_DISCORD_APPLICATION_CLIENT_ID",
]);

const DISCORD_OP_HANDSHAKE = 0;
const DISCORD_OP_FRAME = 1;
const DISCORD_OP_CLOSE = 2;
const DISCORD_OP_PING = 3;
const DISCORD_OP_PONG = 4;
const MAX_DISCORD_IPC_INDEX = 10;

export function printBridgeHelp() {
  console.log(`Knobb Discord Presence Bridge

Usage:
  npm run discord:bridge
  node scripts/discord-presence-bridge.mjs --check

Configuration:
  Create discord-presence.bridge.json in the project root or set KNOBB_DISCORD_CLIENT_ID.
  Optional env vars:
    KNOBB_DISCORD_CLIENT_ID
    KNOBB_DISCORD_BRIDGE_PORT
`);
}

async function readJsonFileIfPresent(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function normalizeClientId(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || CLIENT_ID_PLACEHOLDERS.has(trimmed)) {
    return "";
  }

  return trimmed;
}

export async function loadBridgeConfig(cwd = process.cwd()) {
  const rootConfig = await readJsonFileIfPresent(path.resolve(cwd, "discord-presence.bridge.json"));
  const localConfig = await readJsonFileIfPresent(path.resolve(cwd, "discord-presence.bridge.local.json"));
  const fileConfig = {
    ...rootConfig,
    ...localConfig,
    assets: {
      ...(rootConfig.assets || {}),
      ...(localConfig.assets || {}),
    },
  };

  return {
    clientId: normalizeClientId(process.env.KNOBB_DISCORD_CLIENT_ID || fileConfig.clientId || ""),
    port: Number.parseInt(
      String(process.env.KNOBB_DISCORD_BRIDGE_PORT || fileConfig.port || DEFAULT_BRIDGE_PORT),
      10,
    ) || DEFAULT_BRIDGE_PORT,
    appName: String(fileConfig.appName || "Knobb").trim() || "Knobb",
    siteUrl: String(process.env.KNOBB_SITE_URL || process.env.VITE_SITE_URL || fileConfig.siteUrl || "").trim() || null,
    assets: {
      largeImageKey: String(fileConfig.assets?.largeImageKey || "").trim() || null,
      playImageKey: String(fileConfig.assets?.playImageKey || "").trim() || null,
      pauseImageKey: String(fileConfig.assets?.pauseImageKey || "").trim() || null,
    },
  };
}

function createJsonResponse(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function truncate(value, maxLength = 128) {
  if (!value) return "";
  return String(value).slice(0, maxLength);
}

export function buildDiscordAssets(config, activity) {
  const assets = {};
  const largeImage = activity.largeImageUrl || config.assets.largeImageKey;
  if (largeImage) {
    assets.large_image = largeImage;
    assets.large_text = truncate(activity.largeImageText || config.appName);
  }

  const smallImageKey = activity.smallImageKey === "pause"
    ? config.assets.pauseImageKey
    : config.assets.playImageKey;

  if (smallImageKey) {
    assets.small_image = smallImageKey;
    assets.small_text = truncate(activity.smallImageText);
  }

  return Object.keys(assets).length > 0 ? assets : undefined;
}

export function toDiscordActivity(config, activity) {
  const payload = {
    details: truncate(activity.details),
    state: truncate(activity.state),
  };

  if (Number.isFinite(activity.startTimestamp) || Number.isFinite(activity.endTimestamp)) {
    payload.timestamps = {};
    if (Number.isFinite(activity.startTimestamp)) {
      payload.timestamps.start = activity.startTimestamp;
    }
    if (Number.isFinite(activity.endTimestamp)) {
      payload.timestamps.end = activity.endTimestamp;
    }
  }

  const assets = buildDiscordAssets(config, activity);
  if (assets) {
    payload.assets = assets;
  }

  return payload;
}

function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const op = buffer.readInt32LE(offset);
    const length = buffer.readInt32LE(offset + 4);
    if (offset + 8 + length > buffer.length) {
      break;
    }

    const payload = buffer.subarray(offset + 8, offset + 8 + length).toString("utf8");
    frames.push({ op, payload });
    offset += 8 + length;
  }

  return {
    frames,
    remainder: buffer.subarray(offset),
  };
}

function encodeFrame(op, payload) {
  const payloadBuffer = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(8);
  header.writeInt32LE(op, 0);
  header.writeInt32LE(payloadBuffer.length, 4);
  return Buffer.concat([header, payloadBuffer]);
}

function getDiscordPipeCandidates() {
  if (process.platform === "win32") {
    return Array.from({ length: MAX_DISCORD_IPC_INDEX }, (_, index) => `\\\\?\\pipe\\discord-ipc-${index}`);
  }

  const directories = [
    process.env.XDG_RUNTIME_DIR,
    process.env.TMPDIR,
    process.env.TMP,
    process.env.TEMP,
    os.tmpdir(),
    "/tmp",
  ].filter(Boolean);

  return [...new Set(directories)].flatMap((directory) =>
    Array.from({ length: MAX_DISCORD_IPC_INDEX }, (_, index) => path.join(directory, `discord-ipc-${index}`)),
  );
}

class DiscordRpcClient {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.connecting = false;
    this.connected = false;
    this.ready = false;
    this.reconnectTimer = null;
    this.pending = new Map();
    this.currentActivity = null;
    this.listeners = new Set();
    this.lastError = null;
  }

  getStatus() {
    return {
      ok: true,
      configured: Boolean(this.config.clientId),
      discordConnected: this.connected && this.ready,
      bridgeVersion: BRIDGE_VERSION,
      lastError: this.lastError,
    };
  }

  getCurrentActivity() {
    return this.currentActivity;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emitStatus() {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  scheduleReconnect(delayMs = 3000) {
    if (!this.config.clientId || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delayMs);
  }

  async connect() {
    if (!this.config.clientId || this.connected || this.connecting) return;
    this.connecting = true;

    for (const pipePath of getDiscordPipeCandidates()) {
      try {
        await this.tryConnect(pipePath);
        this.lastError = null;
        return;
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    }

    this.connecting = false;
    this.connected = false;
    this.ready = false;
    this.emitStatus();
    this.scheduleReconnect();
  }

  tryConnect(pipePath) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(pipePath);
      let settled = false;
      let handshakeResolved = false;

      const finishReject = (error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };

      socket.once("connect", () => {
        this.socket = socket;
        this.buffer = Buffer.alloc(0);
        this.connected = true;
        this.ready = false;
        this.connecting = false;
        this.emitStatus();
        socket.write(encodeFrame(DISCORD_OP_HANDSHAKE, {
          v: 1,
          client_id: this.config.clientId,
        }));
      });

      socket.on("data", (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        const parsed = decodeFrames(this.buffer);
        this.buffer = parsed.remainder;

        for (const frame of parsed.frames) {
          if (frame.op === DISCORD_OP_PING) {
            socket.write(encodeFrame(DISCORD_OP_PONG, JSON.parse(frame.payload)));
            continue;
          }

          if (frame.op === DISCORD_OP_CLOSE) {
            this.lastError = "Discord IPC closed the connection";
            this.handleSocketClose();
            return;
          }

          if (frame.op !== DISCORD_OP_FRAME) {
            continue;
          }

          let message;
          try {
            message = JSON.parse(frame.payload);
          } catch {
            continue;
          }

          if (message.evt === "READY") {
            this.ready = true;
            this.lastError = null;
            this.emitStatus();
            if (!settled) {
              settled = true;
              handshakeResolved = true;
              resolve();
            }
            void this.flushActivity();
            continue;
          }

          if (message.evt === "ERROR") {
            this.lastError = message.data?.message || "Discord RPC returned an error";
          }

          if (message.nonce && this.pending.has(message.nonce)) {
            const resolver = this.pending.get(message.nonce);
            this.pending.delete(message.nonce);
            resolver.resolve(message);
          }
        }
      });

      socket.on("error", (error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
        if (!handshakeResolved) {
          finishReject(error);
          return;
        }
        this.handleSocketClose();
      });

      socket.on("close", () => {
        if (!handshakeResolved) {
          finishReject(new Error(`Discord IPC socket closed before handshake: ${pipePath}`));
          return;
        }
        this.handleSocketClose();
      });
    });
  }

  handleSocketClose() {
    this.connecting = false;
    this.connected = false;
    this.ready = false;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }

    for (const pending of this.pending.values()) {
      pending.reject(new Error("Discord IPC connection closed"));
    }
    this.pending.clear();
    this.emitStatus();
    this.scheduleReconnect();
  }

  sendCommand(command, args) {
    if (!this.socket || !this.connected || !this.ready) {
      return Promise.reject(new Error("Discord IPC is not connected"));
    }

    const nonce = crypto.randomUUID();
    const payload = {
      cmd: command,
      args,
      nonce,
    };

    return new Promise((resolve, reject) => {
      this.pending.set(nonce, { resolve, reject });
      this.socket.write(encodeFrame(DISCORD_OP_FRAME, payload), (error) => {
        if (!error) return;
        this.pending.delete(nonce);
        reject(error);
      });
    });
  }

  async flushActivity() {
    if (!this.currentActivity) {
      try {
        await this.sendCommand("SET_ACTIVITY", {
          pid: process.pid,
        });
      } catch {
        // Reconnect flow retries.
      }
      return;
    }

    try {
      await this.sendCommand("SET_ACTIVITY", {
        pid: process.pid,
        activity: toDiscordActivity(this.config, this.currentActivity),
      });
    } catch {
      // Reconnect flow retries.
    }
  }

  async setActivity(activity) {
    this.currentActivity = activity;
    if (!this.config.clientId) return;
    if (!this.connected || !this.ready) {
      await this.connect();
      return;
    }
    await this.flushActivity();
  }

  async clearActivity() {
    this.currentActivity = null;
    if (!this.config.clientId) return;
    if (!this.connected || !this.ready) {
      await this.connect();
      return;
    }
    await this.flushActivity();
  }

  async close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.connected = false;
    this.ready = false;
    this.connecting = false;
    this.emitStatus();
  }
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export function validateActivity(payload) {
  if (!payload || payload.type !== "set-activity" || typeof payload.activity !== "object" || payload.activity === null) {
    return null;
  }

  const activity = payload.activity;
  if (typeof activity.details !== "string" || typeof activity.state !== "string") {
    return null;
  }

  return {
    details: truncate(activity.details),
    state: truncate(activity.state),
    largeImageText: truncate(activity.largeImageText || ""),
    largeImageUrl: typeof activity.largeImageUrl === "string" ? truncate(activity.largeImageUrl, 2048) : undefined,
    sourceUrl: typeof activity.sourceUrl === "string" ? truncate(activity.sourceUrl, 512) : undefined,
    smallImageKey: activity.smallImageKey === "pause" ? "pause" : "play",
    smallImageText: truncate(activity.smallImageText || ""),
    startTimestamp: Number.isFinite(activity.startTimestamp) ? Number(activity.startTimestamp) : undefined,
    endTimestamp: Number.isFinite(activity.endTimestamp) ? Number(activity.endTimestamp) : undefined,
  };
}

export async function createDiscordPresenceController(options = {}) {
  const config = options.config || await loadBridgeConfig(options.cwd);
  const rpcClient = new DiscordRpcClient(config);
  const listeners = new Set();
  let started = false;

  const controller = {
    config,
    getStatus() {
      return {
        ...rpcClient.getStatus(),
        port: config.port,
        appName: config.appName,
        currentActivity: rpcClient.getCurrentActivity(),
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start() {
      if (started) return controller;
      started = true;

      const emit = () => {
        const snapshot = controller.getStatus();
        for (const listener of listeners) {
          listener(snapshot);
        }
      };

      rpcClient.subscribe(emit);

      if (config.clientId) {
        void rpcClient.connect();
      }

      emit();
      return controller;
    },
    async setActivity(activity) {
      await rpcClient.setActivity(activity);
    },
    async clearActivity() {
      await rpcClient.clearActivity();
    },
    async close() {
      await rpcClient.close();
    },
  };

  return controller;
}

export async function createBridgeService(options = {}) {
  const config = options.config || await loadBridgeConfig(options.cwd);
  const controller = await createDiscordPresenceController({ ...options, config });

  const service = {
    ...controller,
    server: null,
    async start() {
      if (service.server) return service;

      await controller.start();

      service.server = http.createServer(async (req, res) => {
        if (!req.url) {
          createJsonResponse(res, 404, { error: "Not found" });
          return;
        }

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.end();
          return;
        }

        const requestUrl = new URL(req.url, `http://127.0.0.1:${config.port}`);

        if (req.method === "GET" && requestUrl.pathname === "/status") {
          createJsonResponse(res, 200, controller.getStatus());
          return;
        }

        if (req.method === "POST" && requestUrl.pathname === "/activity") {
          try {
            const payload = await parseRequestBody(req);
            if (payload?.type === "clear-activity") {
              await controller.clearActivity();
              createJsonResponse(res, 200, { ok: true, status: controller.getStatus() });
              return;
            }

            const activity = validateActivity(payload);
            if (!activity) {
              createJsonResponse(res, 400, { error: "Invalid activity payload", status: controller.getStatus() });
              return;
            }

            await controller.setActivity(activity);
            createJsonResponse(res, 200, { ok: true, status: controller.getStatus() });
            return;
          } catch (error) {
            createJsonResponse(res, 500, {
              error: error instanceof Error ? error.message : "Unknown bridge error",
              status: controller.getStatus(),
            });
            return;
          }
        }

        createJsonResponse(res, 404, { error: "Not found" });
      });

      await new Promise((resolve, reject) => {
        service.server.once("error", reject);
        service.server.listen(config.port, "127.0.0.1", () => {
          service.server.off("error", reject);
          resolve(undefined);
        });
      });

      return service;
    },
    async close() {
      await controller.close();
      if (!service.server) return;
      await new Promise((resolve) => {
        service.server.close(() => {
          resolve(undefined);
        });
      });
      service.server = null;
    },
  };

  return service;
}
