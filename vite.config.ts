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
const ARTISTGRID_TRENDS_URL = "https://trends.artistgrid.cx";
const ARTISTGRID_TRACKER_URL = "https://tracker.israeli.ovh/get";

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

function unreleasedProxyPlugin() {
  return {
    name: "unreleased-proxy",
    configureServer(server: {
      middlewares: {
        use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void;
      };
    }) {
      server.middlewares.use("/api/unreleased", (req, res) => {
        void proxyUnreleasedRequest(req, res);
      });
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
  plugins: [react(), unreleasedProxyPlugin(), spaFallbackPlugin()],
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
