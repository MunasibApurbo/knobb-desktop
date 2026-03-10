import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs/promises";
import type { IncomingMessage, ServerResponse } from "http";

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

const ARTISTGRID_ARTISTS_URL = "https://sheets.artistgrid.cx/artists.ndjson";
const ARTISTGRID_BACKUP_CSV_URL = "https://raw.githubusercontent.com/ArtistGrid/artistgrid-dev/main/public/backup.csv";
const ARTISTGRID_TRENDS_URL = "https://trends.artistgrid.cx";
const ARTISTGRID_TRACKER_URL = "https://tracker.israeli.ovh/get";
const TIDAL_BROWSE_BASE_URL = "https://api.tidal.com/v1";
const TIDAL_V2_TOKEN = "txNoH4kkV41MfH25";

function resolveUnreleasedProxyTarget(requestUrl: URL) {
  const resource = requestUrl.searchParams.get("resource");

  if (resource === "artists") {
    return ARTISTGRID_ARTISTS_URL;
  }

  if (resource === "trends") {
    return ARTISTGRID_TRENDS_URL;
  }

  if (resource === "tracker") {
    const sheetId = requestUrl.searchParams.get("sheetId")?.trim();
    if (!sheetId || !/^[a-zA-Z0-9_-]+$/.test(sheetId)) {
      return null;
    }

    return `${ARTISTGRID_TRACKER_URL}/${sheetId}`;
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
  const primary = await fetch(ARTISTGRID_ARTISTS_URL);
  const primaryBody = Buffer.from(await primary.arrayBuffer()).toString("utf8");

  if (primary.ok && primaryBody.trim()) {
    return {
      status: primary.status,
      body: primaryBody,
      contentType: primary.headers.get("content-type") || "application/x-ndjson; charset=utf-8",
    };
  }

  const backup = await fetch(ARTISTGRID_BACKUP_CSV_URL);
  const backupBody = Buffer.from(await backup.arrayBuffer()).toString("utf8");
  if (!backup.ok || !backupBody.trim()) {
    return {
      status: primary.status || backup.status,
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

async function proxyUnreleasedRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const requestUrl = new URL(req.url || "/api/unreleased", "http://localhost");
  const target = resolveUnreleasedProxyTarget(requestUrl);

  if (!target) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid unreleased resource request" }));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    if (requestUrl.searchParams.get("resource") === "artists") {
      const artists = await fetchUnreleasedArtistsBody();

      res.statusCode = artists.status;
      res.setHeader("Content-Type", artists.contentType);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.end(artists.body);
      return;
    }

    const upstream = await fetch(target, { signal: controller.signal });
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
  } finally {
    clearTimeout(timeout);
  }
}

function buildTidalBrowseProxyTarget(requestUrl: URL) {
  const path = requestUrl.searchParams.get("path")?.trim();
  if (!path || !/^pages(?:\/[A-Za-z0-9._-]+)+$/.test(path)) {
    return null;
  }

  const locale = requestUrl.searchParams.get("locale")?.trim();
  const countryCode = requestUrl.searchParams.get("countryCode")?.trim();
  const deviceType = requestUrl.searchParams.get("deviceType")?.trim();
  const limit = requestUrl.searchParams.get("limit")?.trim();
  const offset = requestUrl.searchParams.get("offset")?.trim();

  const params = new URLSearchParams({
    locale: locale && /^[a-z]{2}_[A-Z]{2}$/.test(locale) ? locale : "en_US",
    countryCode: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : "US",
    deviceType: deviceType && /^[A-Z_]+$/.test(deviceType) ? deviceType : "BROWSER",
  });

  if (limit && /^\d+$/.test(limit)) {
    params.set("limit", limit);
  }

  if (offset && /^\d+$/.test(offset)) {
    params.set("offset", offset);
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

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), unreleasedProxyPlugin(), tidalBrowseProxyPlugin(), spaFallbackPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
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
          if (id.includes("recharts")) return "charts";
          if (id.includes("@tanstack/react-query")) return "react-query";
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
