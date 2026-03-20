#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const DEFAULT_TIMEOUT_MS = 10000;
const ROOT_MARKER = '<div id="root"></div>';
const execFileAsync = promisify(execFile);
const ENV_FILES = [".env.local", ".env"];

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

function readEnvFile(path) {
  if (!existsSync(path)) return new Map();

  const raw = readFileSync(path, "utf8");
  const map = new Map();

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    map.set(key, value);
  }

  return map;
}

function resolveEnvVar(name) {
  const runtimeValue = process.env[name];
  if (runtimeValue && String(runtimeValue).trim()) {
    return String(runtimeValue).trim();
  }

  const root = process.cwd();
  for (const file of ENV_FILES) {
    const value = readEnvFile(resolve(root, file)).get(name);
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
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

async function verifyOAuthAuthorize(supabaseUrl, baseUrl, provider, expectedHost, timeoutMs) {
  const redirectTo = new URL("/auth?next=%2Fprofile", baseUrl).toString();
  const url = new URL("/auth/v1/authorize", supabaseUrl);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", redirectTo);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
      redirect: "manual",
      signal: controller.signal,
    });

    const location = response.headers.get("location") || "";
    const ok = response.status >= 300
      && response.status < 400
      && location.includes(expectedHost);

    return {
      ok,
      label: `${provider} OAuth`,
      detail: ok
        ? `${response.status} -> ${expectedHost}`
        : `status ${response.status}, location ${location || "missing"}`,
    };
  } catch (error) {
    return {
      ok: false,
      label: `${provider} OAuth`,
      detail: error instanceof Error ? error.message : "request failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function verifyOAuthProviderPage(supabaseUrl, baseUrl, provider, expectedHost, timeoutMs, failureMarkers = []) {
  const redirectTo = new URL("/auth?next=%2Fprofile", baseUrl).toString();
  const url = new URL("/auth/v1/authorize", supabaseUrl);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", redirectTo);
  const providerCallbackUrl = new URL("/auth/v1/callback", supabaseUrl).toString();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    const finalUrl = response.url || "";
    const body = await response.text();
    const matchedMarker = failureMarkers.find((marker) => body.includes(marker) || finalUrl.includes(marker));
    const ok = response.ok && finalUrl.includes(expectedHost) && !matchedMarker;

    return {
      ok,
      label: `${provider} OAuth page`,
      detail: ok
        ? `${response.status} -> ${finalUrl}`
        : matchedMarker
          ? provider === "discord" && matchedMarker.includes("Invalid OAuth2 redirect_uri")
            ? `failed with marker "${matchedMarker}" at ${finalUrl || "unknown url"}; add ${providerCallbackUrl} to the Discord app OAuth2 redirect URIs`
            : `failed with marker "${matchedMarker}" at ${finalUrl || "unknown url"}`
          : `status ${response.status}, final url ${finalUrl || "missing"}`,
    };
  } catch (error) {
    return {
      ok: false,
      label: `${provider} OAuth page`,
      detail: error instanceof Error ? error.message : "request failed",
    };
  } finally {
    clearTimeout(timeoutId);
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
  const supabaseUrl = normalizeBaseUrl(resolveEnvVar("VITE_SUPABASE_URL"));

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

  if (supabaseUrl) {
    const oauthChecks = await Promise.all([
      verifyOAuthAuthorize(supabaseUrl, baseUrl, "google", "accounts.google.com", timeoutMs),
      verifyOAuthAuthorize(supabaseUrl, baseUrl, "discord", "discord.com", timeoutMs),
      verifyOAuthProviderPage(
        supabaseUrl,
        baseUrl,
        "google",
        "accounts.google.com",
        timeoutMs,
        ["deleted_client", "/signin/oauth/error"],
      ),
      verifyOAuthProviderPage(
        supabaseUrl,
        baseUrl,
        "discord",
        "discord.com",
        timeoutMs,
        ["Invalid OAuth2 redirect_uri", "/oauth2/error"],
      ),
    ]);

    for (const check of oauthChecks) {
      printResult(check.ok, check.label, check.detail);
      failed ||= !check.ok;
    }
  } else {
    printResult(false, "OAuth provider checks", "set VITE_SUPABASE_URL to verify Google and Discord handoff");
  }

  console.log("\nManual follow-up still required:");
  console.log("1) Complete a real Google and Discord login in the browser");
  console.log("2) Library mutations: likes, albums, playlists");
  console.log("3) Collaboration and share-link flows");
  console.log("4) Playback start and recovery against the intended instance pool");

  if (failed) {
    process.exitCode = 1;
  }
}

await main();
