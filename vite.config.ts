import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import compression from "vite-plugin-compression";
import path from "path";
import fs from "fs/promises";
import type { IncomingMessage, ServerResponse } from "http";
import { proxyAudioHttpRequest } from "./server/audioProxy.js";
import { proxyDiscordWebhookHttpRequest } from "./server/discordWebhookProxy.js";
import { proxyImageHttpRequest } from "./server/imageProxy.js";
import { proxyYoutubeMusicHttpRequest } from "./server/youtubeMusicProxy.js";

function isNodeModulePackage(id: string, pkg: string) {
  return id.includes(`/node_modules/${pkg}/`);
}

function spaFallbackPlugin() {
  return {
    name: "spa-fallback-404",
    closeBundle: async () => {
      const outDir = path.resolve(__dirname, "dist");
      const indexPath = path.join(outDir, "index.html");
      const fallbackPath = path.join(outDir, "404.html");

      try {
        const indexHtml = await fs.readFile(indexPath, "utf8");
        await fs.writeFile(fallbackPath, indexHtml, "utf8");
      } catch (error) {
        console.warn("Failed to generate 404.html fallback", error);
      }
    },
  };
}

const ARTISTGRID_ARTIST_SOURCES = [
  "https://assets.artistgrid.cx/artists.ndjson",
  "https://sheets.artistgrid.cx/artists.ndjson",
  "https://git.sad.ovh/sophie/sheets/raw/branch/main/artists.ndjson",
];
const ARTISTGRID_BACKUP_CSV_URL = "https://raw.githubusercontent.com/ArtistGrid/artistgrid-dev/main/public/backup.csv";
const ARTISTGRID_TRENDS_URL = "https://trends.artistgrid.cx";
const ARTISTGRID_TRACKER_BASE_URLS = [
  "https://trackerapi-2.artistgrid.cx",
  "https://tracker.thug.surf",
];
const TIDAL_BROWSE_BASE_URL = "https://api.tidal.com/v1";
const TIDAL_V2_TOKEN = "txNoH4kkV41MfH25";

function resolveUnreleasedProxyTarget(requestUrl: URL) {
  const resource = requestUrl.searchParams.get("resource");

  if (resource === "artists") {
    return null;
  }

  if (resource === "trends") {
    return ARTISTGRID_TRENDS_URL;
  }

  if (resource === "tested") {
    return ARTISTGRID_TRACKER_BASE_URLS.map((baseUrl) => `${baseUrl}/tested`);
  }

  if (resource === "tracker") {
    const sheetId = requestUrl.searchParams.get("sheetId")?.trim();
    if (!sheetId || !/^[a-zA-Z0-9_-]+$/.test(sheetId)) {
      return null;
    }

    const tab = requestUrl.searchParams.get("tab")?.trim()?.slice(0, 120);

    return ARTISTGRID_TRACKER_BASE_URLS.map((baseUrl) => {
      const target = new URL(`${baseUrl}/get/${sheetId}`);
      if (tab) {
        target.searchParams.set("tab", tab);
      }
      return target.toString();
    });
  }

  return null;
}

function parseBackupArtistsCsv(csvText: string) {
  const lines = csvText.trim().split("\n");
  const artists: string[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;

    const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((value) => value.replace(/^"|"$/g, "").trim()) || [];
    if (matches.length < 2) continue;

    const [name, url] = matches;
    if (!name || !url) continue;
    artists.push(JSON.stringify({ name, url }));
  }

  return artists.join("\n");
}

async function fetchUnreleasedArtistsBody() {
  let primaryStatus = 502;

  for (const source of ARTISTGRID_ARTIST_SOURCES) {
    try {
      const primary = await fetchWithTimeout(source);
      primaryStatus = primary.status;
      const primaryBody = Buffer.from(await primary.arrayBuffer()).toString("utf8");

      if (primary.ok && primaryBody.trim()) {
        return {
          status: primary.status,
          body: primaryBody,
          contentType: primary.headers.get("content-type") || "application/x-ndjson; charset=utf-8",
        };
      }
    } catch (error) {
      console.warn("unreleased proxy artists source failed", source, error);
    }
  }

  const backup = await fetchWithTimeout(ARTISTGRID_BACKUP_CSV_URL);
  const backupBody = Buffer.from(await backup.arrayBuffer()).toString("utf8");
  if (!backup.ok || !backupBody.trim()) {
    return {
      status: primaryStatus || backup.status,
      body: "",
      contentType: backup.headers.get("content-type") || "text/plain; charset=utf-8",
    };
  }

  return {
    status: 200,
    body: parseBackupArtistsCsv(backupBody),
    contentType: "application/x-ndjson; charset=utf-8",
  };
}

async function fetchWithTimeout(target: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(target, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFirstSuccessful(targets: string | string[], timeoutMs = 10000) {
  const targetList = Array.isArray(targets) ? targets : [targets];
  let lastResponse: Response | null = null;

  for (const target of targetList) {
    try {
      const response = await fetchWithTimeout(target, timeoutMs);
      lastResponse = response;
      if (response.ok) {
        return response;
      }
    } catch (error) {
      console.warn("unreleased proxy upstream target failed", target, error);
    }
  }

  return lastResponse;
}

async function proxyUnreleasedRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const requestUrl = new URL(req.url || "/api/unreleased", "http://localhost");
  const target = resolveUnreleasedProxyTarget(requestUrl);

  if (requestUrl.searchParams.get("resource") !== "artists" && !target) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid unreleased resource request" }));
    return;
  }

  try {
    if (requestUrl.searchParams.get("resource") === "artists") {
      const artists = await fetchUnreleasedArtistsBody();

      res.statusCode = artists.status;
      res.setHeader("Content-Type", artists.contentType);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.end(artists.body);
      return;
    }

    const upstream = await fetchFirstSuccessful(target);
    if (!upstream) {
      throw new Error("No ArtistGrid upstream responded");
    }
    const body = Buffer.from(await upstream.arrayBuffer());

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.end(body);
  } catch (error) {
    console.error("unreleased proxy error", error);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Failed to load upstream unreleased data" }));
  }
}

function buildTidalBrowseProxyTarget(requestUrl: URL) {
  const path = requestUrl.searchParams.get("path")?.trim();
  const isPagesPath = Boolean(path && /^pages(?:\/[A-Za-z0-9._-]+)+$/.test(path));
  const isGenresPath = Boolean(path && (path === "genres" || /^genres\/[A-Za-z0-9._-]+$/.test(path)));
  const isDirectResourcePath = Boolean(path && /^(albums|artists|playlists|tracks|videos)\/[A-Za-z0-9._-]+$/.test(path));
  if (!path || (!isPagesPath && !isGenresPath && !isDirectResourcePath)) {
    return null;
  }

  const locale = requestUrl.searchParams.get("locale")?.trim();
  const countryCode = requestUrl.searchParams.get("countryCode")?.trim();
  const deviceType = requestUrl.searchParams.get("deviceType")?.trim();
  const limit = requestUrl.searchParams.get("limit")?.trim();
  const offset = requestUrl.searchParams.get("offset")?.trim();
  const filterId = requestUrl.searchParams.get("filterId")?.trim();

  const params = new URLSearchParams({
    locale: locale && /^[a-z]{2}_[A-Z]{2}$/.test(locale) ? locale : "en_US",
    countryCode: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : "US",
  });

  if (isPagesPath) {
    params.set("deviceType", deviceType && /^[A-Z_]+$/.test(deviceType) ? deviceType : "BROWSER");
  }

  if (limit && /^\d+$/.test(limit)) {
    params.set("limit", limit);
  }

  if (offset && /^\d+$/.test(offset)) {
    params.set("offset", offset);
  }

  if (filterId && /^[A-Za-z0-9._-]+$/.test(filterId)) {
    params.set("filter[id]", filterId);
  }

  return `${TIDAL_BROWSE_BASE_URL}/${path}?${params.toString()}`;
}

async function proxyTidalBrowseRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const requestUrl = new URL(req.url || "/api/tidal-browse", "http://localhost");
  const target = buildTidalBrowseProxyTarget(requestUrl);
  if (!target) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid TIDAL browse path" }));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const upstream = await fetch(target, {
      signal: controller.signal,
      headers: {
        "X-Tidal-Token": TIDAL_V2_TOKEN,
      },
    });
    const body = Buffer.from(await upstream.arrayBuffer());

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.end(body);
  } catch (error) {
    console.error("tidal browse proxy error", error);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Failed to load upstream TIDAL browse data" }));
  } finally {
    clearTimeout(timeout);
  }
}

function unreleasedProxyPlugin() {
  const attach = (middlewares: {
    use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
  }) => {
    middlewares.use("/api/unreleased", (req, res) => {
      void proxyUnreleasedRequest(req, res);
    });
  };

  return {
    name: "unreleased-proxy",
    configureServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
    configurePreviewServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
  };
}

function tidalBrowseProxyPlugin() {
  const attach = (middlewares: {
    use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
  }) => {
    middlewares.use("/api/tidal-browse", (req, res) => {
      void proxyTidalBrowseRequest(req, res);
    });
  };

  return {
    name: "tidal-browse-proxy",
    configureServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
    configurePreviewServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
  };
}

function youtubeMusicProxyPlugin() {
  const attach = (middlewares: {
    use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
  }) => {
    const handler = (req: IncomingMessage, res: ServerResponse) => {
      void proxyYoutubeMusicHttpRequest(req, res);
    };

    middlewares.use("/api/youtube-music", handler);
    middlewares.use("/.netlify/functions/youtube-music-proxy", handler);
  };

  return {
    name: "youtube-music-proxy",
    configureServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
    configurePreviewServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
  };
}

function imageProxyPlugin() {
  const attach = (middlewares: {
    use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
  }) => {
    middlewares.use("/api/image-proxy", (req, res) => {
      void proxyImageHttpRequest(req, res);
    });
  };

  return {
    name: "image-proxy",
    configureServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
    configurePreviewServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
  };
}

function discordWebhookProxyPlugin() {
  const attach = (middlewares: {
    use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
  }) => {
    const handler = (req: IncomingMessage, res: ServerResponse) => {
      void proxyDiscordWebhookHttpRequest(req, res);
    };

    middlewares.use("/api/discord-webhook", handler);
    middlewares.use("/.netlify/functions/discord-webhook", handler);
  };

  return {
    name: "discord-webhook-proxy",
    configureServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
    configurePreviewServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
  };
}

function audioProxyPlugin() {
  const attach = (middlewares: {
    use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
  }) => {
    middlewares.use("/api/audio-proxy", (req, res) => {
      void proxyAudioHttpRequest(req, res);
    });
  };

  return {
    name: "audio-proxy",
    configureServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
    configurePreviewServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      attach(server.middlewares);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    compression({
      algorithm: "brotliCompress",
      ext: ".br",
      threshold: 1024,
    }),
    compression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024,
    }),
    audioProxyPlugin(),
    unreleasedProxyPlugin(),
    tidalBrowseProxyPlugin(),
    youtubeMusicProxyPlugin(),
    imageProxyPlugin(),
    discordWebhookProxyPlugin(),
    spaFallbackPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    modulePreload: false,
    // `dashjs` is intentionally lazy-loaded as a standalone playback dependency,
    // so the default 500 kB warning is too noisy for this repo's startup profile.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            isNodeModulePackage(id, "react") ||
            isNodeModulePackage(id, "react-dom") ||
            isNodeModulePackage(id, "scheduler")
          ) {
            return "react-core";
          }

          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@supabase/")) return "supabase";
          if (id.includes("@uimaxbai/am-lyrics")) return "lyrics";
          if (id.includes("recharts")) return "charts";
          if (id.includes("react-router-dom")) return "router";
          if (id.includes("lucide-react")) return "icons";
          if (
            id.includes("date-fns") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("class-variance-authority") ||
            id.includes("zod")
          ) {
            return "utils";
          }

          // Let Rollup keep route-specific dependencies with their lazy chunks
          // instead of forcing them into a shared startup bundle.
          return;
        },
      }
    },
  },
}));
