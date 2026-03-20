import { createReadStream } from "fs";
import { access, readFile } from "fs/promises";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(rootDir, "deploy-backup-site");
const host = process.env.HOST || "127.0.0.1";
const initialPort = Number(process.env.PORT || "8080");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
]);

function contentTypeFor(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function isAssetPath(pathname) {
  return pathname.startsWith("/assets/")
    || pathname.startsWith("/brand/")
    || /\.[A-Za-z0-9]+$/.test(pathname);
}

function safeJoin(baseDir, pathname) {
  const cleanedPath = pathname.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(baseDir, cleanedPath));
  if (!filePath.startsWith(baseDir)) {
    return null;
  }
  return filePath;
}

async function resolveFilePath(requestPathname) {
  const directPath = safeJoin(siteDir, requestPathname === "/" ? "/index.html" : requestPathname);
  if (directPath) {
    try {
      await access(directPath);
      return directPath;
    } catch {
      // Fall through to SPA fallback.
    }
  }

  if (isAssetPath(requestPathname)) {
    return null;
  }

  return path.join(siteDir, "index.html");
}

async function createServer() {
  try {
    await access(siteDir);
  } catch {
    console.error(`Missing recovered deploy bundle at ${siteDir}`);
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const filePath = await resolveFilePath(requestUrl.pathname);

    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    try {
      const headers = {
        "Content-Type": contentTypeFor(filePath),
      };

      if (filePath.endsWith(".html")) {
        headers["Cache-Control"] = "no-store";
      }

      res.writeHead(200, headers);
      createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Failed to serve file");
      console.error("dev server error", error);
    }
  });

  const listenOn = (port) => new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve(port);
    });
  });

  let port = initialPort;
  while (port < initialPort + 20) {
    try {
      const activePort = await listenOn(port);
      const indexHtml = await readFile(path.join(siteDir, "index.html"), "utf8");
      const match = indexHtml.match(/<script type="module" crossorigin src="([^"]+)"/);
      console.log(`Recovered deploy dev server running at http://${host}:${activePort}/`);
      console.log(`SPA fallback enabled. Try http://${host}:${activePort}/app`);
      if (match) {
        console.log(`Entry asset: ${match[1]}`);
      }
      return;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        port += 1;
        continue;
      }
      throw error;
    }
  }

  console.error(`No free port found in range ${initialPort}-${initialPort + 19}`);
  process.exit(1);
}

createServer().catch((error) => {
  console.error("Failed to start recovered deploy dev server.", error);
  process.exit(1);
});
