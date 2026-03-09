#!/usr/bin/env node
import { execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const DEFAULT_TIMEOUT_MS = 10000;
const ROOT_MARKER = '<div id="root"></div>';
const execFileAsync = promisify(execFile);

function normalizeBaseUrl(value) {
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const args = { baseUrl: "", timeoutMs: DEFAULT_TIMEOUT_MS };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--timeout") {
      const next = Number.parseInt(argv[index + 1] || "", 10);
      if (Number.isFinite(next) && next > 0) {
        args.timeoutMs = next;
      }
      index += 1;
      continue;
    }

    if (!args.baseUrl) {
      args.baseUrl = value;
    }
  }

  return args;
}

function printResult(ok, label, detail = "") {
  const status = ok ? "OK" : "FAIL";
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`[${status}] ${label}${suffix}`);
}

async function requestUrl(url, timeoutMs) {
  const maxTimeSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const markerStatus = "__STATUS__:";
  const markerType = "__CONTENT_TYPE__:";
  const { stdout } = await execFileAsync("curl", [
    "-sS",
    "-L",
    "--max-time",
    String(maxTimeSeconds),
    "-H",
    "Accept: text/html,application/json;q=0.9,*/*;q=0.8",
    "-o",
    "-",
    "-w",
    `\n${markerStatus}%{http_code}\n${markerType}%{content_type}\n`,
    String(url),
  ]);

  const statusIndex = stdout.lastIndexOf(`\n${markerStatus}`);
  const typeIndex = stdout.lastIndexOf(`\n${markerType}`);
  if (statusIndex === -1 || typeIndex === -1 || typeIndex < statusIndex) {
    throw new Error("Could not parse curl response metadata");
  }

  const body = stdout.slice(0, statusIndex);
  const status = Number.parseInt(
    stdout.slice(statusIndex + markerStatus.length + 1, typeIndex).trim(),
    10,
  );
  const contentType = stdout.slice(typeIndex + markerType.length + 1).trim();

  return {
    ok: status >= 200 && status < 300,
    status,
    contentType,
    body,
  };
}

async function verifyHtmlRoute(baseUrl, path, timeoutMs) {
  const target = new URL(path, baseUrl);
  const response = await requestUrl(target, timeoutMs);
  const ok = response.ok && response.contentType.includes("text/html") && response.body.includes(ROOT_MARKER);

  return {
    ok,
    label: path,
    detail: ok ? `${response.status}` : `status ${response.status}, content-type ${response.contentType || "unknown"}`,
  };
}

async function verifyOptionalJsonRoute(baseUrl, path, timeoutMs) {
  const target = new URL(path, baseUrl);

  try {
    const response = await requestUrl(target, timeoutMs);
    const ok = response.ok && response.contentType.includes("application/json");

    return {
      ok,
      label: path,
      detail: ok ? `${response.status}` : `status ${response.status}, content-type ${response.contentType || "unknown"}`,
    };
  } catch (error) {
    return {
      ok: false,
      label: path,
      detail: error instanceof Error ? error.message : "request failed",
    };
  }
}

async function waitForServer(baseUrl, timeoutMs) {
  const startedAt = Date.now();
  let lastError = "server did not respond";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await requestUrl(new URL("/", baseUrl), Math.min(timeoutMs, 2000));
      if (response.ok) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    }

    await delay(300);
  }

  throw new Error(lastError);
}

async function main() {
  const { baseUrl: rawBaseUrl, timeoutMs } = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(rawBaseUrl || process.env.SITE_URL || process.env.VITE_SITE_URL || "");

  if (!baseUrl) {
    console.error("Usage: npm run smoke:site -- <site-url> [--timeout 10000]");
    process.exitCode = 1;
    return;
  }

  console.log(`Knobb launch smoke test\n`);
  console.log(`Base URL: ${baseUrl}\n`);

  await waitForServer(baseUrl, timeoutMs);

  const routeChecks = await Promise.all([
    verifyHtmlRoute(baseUrl, "/", timeoutMs),
    verifyHtmlRoute(baseUrl, "/browse", timeoutMs),
    verifyHtmlRoute(baseUrl, "/search?q=knobb", timeoutMs),
    verifyHtmlRoute(baseUrl, "/this-route-should-fall-back", timeoutMs),
  ]);

  let failed = false;
  for (const check of routeChecks) {
    printResult(check.ok, `HTML route ${check.label}`, check.detail);
    failed ||= !check.ok;
  }

  const unreleasedCheck = await verifyOptionalJsonRoute(
    baseUrl,
    "/.netlify/functions/unreleased-proxy?resource=artists",
    timeoutMs,
  );
  printResult(
    unreleasedCheck.ok,
    `Optional JSON route ${unreleasedCheck.label}`,
    unreleasedCheck.ok
      ? unreleasedCheck.detail
      : "skip or investigate if unreleased features are part of this launch",
  );

  console.log("\nManual follow-up still required:");
  console.log("1) Sign in, sign out, and password reset");
  console.log("2) Library mutations: likes, albums, playlists");
  console.log("3) Collaboration and share-link flows");
  console.log("4) Playback start and recovery against the intended instance pool");

  if (failed) {
    process.exitCode = 1;
  }
}

await main();
