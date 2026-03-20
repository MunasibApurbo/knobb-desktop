import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const DEFAULT_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type, Range",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
  Vary: "Origin, Range",
};

const DEV_ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function normalizeOrigin(originValue) {
  if (typeof originValue !== "string" || !originValue.trim()) {
    return null;
  }

  try {
    return new URL(originValue).origin;
  } catch {
    return null;
  }
}

function getConfiguredAllowedOrigins() {
  const configuredOrigins = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.VITE_SITE_URL,
  ]
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  return new Set([...DEV_ALLOWED_ORIGINS, ...configuredOrigins]);
}

function resolveAllowedOrigin(originHeader) {
  const origin = normalizeOrigin(originHeader);
  if (!origin) return null;
  return getConfiguredAllowedOrigins().has(origin) ? origin : null;
}

function applyDefaultHeaders(res, originHeader) {
  const allowedOrigin = resolveAllowedOrigin(originHeader);
  const responseHeaders = {
    ...DEFAULT_HEADERS,
    "Access-Control-Allow-Origin": allowedOrigin || "null",
  };

  Object.entries(responseHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function buildDefaultHeaders(originHeader) {
  return {
    ...DEFAULT_HEADERS,
    "Access-Control-Allow-Origin": resolveAllowedOrigin(originHeader) || "null",
  };
}

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function isIpV4Private(hostname) {
  if (/^127\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;

  const match = hostname.match(/^172\.(\d+)\./);
  if (!match) return false;

  const secondOctet = Number.parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isBlockedAudioProxyHost(hostname) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (normalized === "::1" || normalized === "[::1]") return true;
  if (normalized.endsWith(".local")) return true;
  if (normalized.endsWith(".internal")) return true;
  if (/^169\.254\./.test(normalized)) return true;
  if (isIpV4Private(normalized)) return true;
  return false;
}

function resolveAudioProxyTarget(urlValue) {
  if (typeof urlValue !== "string" || !urlValue.trim()) {
    return null;
  }

  try {
    const parsedUrl = new URL(urlValue);
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return null;
    }
    if (isBlockedAudioProxyHost(parsedUrl.hostname)) {
      return null;
    }
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(target, headers = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(target, {
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isHeadRequest(method) {
  return typeof method === "string" && method.toUpperCase() === "HEAD";
}

function writeError(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  applyDefaultHeaders(res, res.req?.headers?.origin);
  res.end(JSON.stringify({ error: message }));
}

function buildUpstreamHeaders(rangeHeader) {
  const headers = {
    Accept: "audio/*,*/*;q=0.8",
  };

  if (typeof rangeHeader === "string" && rangeHeader.trim()) {
    headers.Range = rangeHeader.trim();
  }

  return headers;
}

function copyUpstreamHeadersToNodeResponse(upstream, res) {
  applyDefaultHeaders(res, res.req?.headers?.origin);

  for (const [key, value] of upstream.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    res.setHeader(key, value);
  }
}

function buildNetlifyHeaders(upstream) {
  const headers = {};

  for (const [key, value] of upstream.headers.entries()) {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    headers[key] = value;
  }

  return headers;
}

function isAllowedAudioContentType(contentType) {
  if (typeof contentType !== "string" || !contentType.trim()) {
    return true;
  }

  const normalized = contentType.toLowerCase();
  return normalized.startsWith("audio/")
    || normalized.startsWith("video/")
    || normalized.startsWith("application/octet-stream")
    || normalized.startsWith("application/vnd.apple.mpegurl")
    || normalized.startsWith("application/x-mpegurl");
}

function isCrossSiteRequest(headers) {
  const secFetchSite = String(headers?.["sec-fetch-site"] || headers?.["Sec-Fetch-Site"] || "").toLowerCase();
  return secFetchSite === "cross-site";
}

async function pipeUpstreamToNodeResponse(upstream, res) {
  res.statusCode = upstream.status;
  copyUpstreamHeadersToNodeResponse(upstream, res);

  if (!upstream.body) {
    res.end();
    return;
  }

  await pipeline(Readable.fromWeb(upstream.body), res);
}

export async function proxyAudioHttpRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    applyDefaultHeaders(res, req.headers.origin);
    res.end("ok");
    return;
  }

  if (req.method !== "GET" && !isHeadRequest(req.method)) {
    writeError(res, 405, "Method not allowed");
    return;
  }

  if (isCrossSiteRequest(req.headers)) {
    writeError(res, 403, "Cross-site audio proxy requests are not allowed");
    return;
  }

  const requestUrl = new URL(req.url || "/api/audio-proxy", "http://localhost");
  const target = resolveAudioProxyTarget(requestUrl.searchParams.get("url"));
  if (!target) {
    writeError(res, 400, "Invalid audio URL");
    return;
  }

  try {
    const upstream = await fetchWithTimeout(target, buildUpstreamHeaders(req.headers.range));
    if (!isAllowedAudioContentType(upstream.headers.get("content-type"))) {
      writeError(res, 415, "Upstream response is not an audio stream");
      return;
    }
    if (isHeadRequest(req.method)) {
      res.statusCode = upstream.status;
      copyUpstreamHeadersToNodeResponse(upstream, res);
      res.end();
      return;
    }

    await pipeUpstreamToNodeResponse(upstream, res);
  } catch (error) {
    console.error("audio proxy error", error);
    writeError(res, 502, "Failed to load upstream audio");
  }
}

export async function proxyAudioNetlifyEvent(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: buildDefaultHeaders(event.headers?.origin || event.headers?.Origin),
      body: "ok",
    };
  }

  if (event.httpMethod !== "GET" && !isHeadRequest(event.httpMethod)) {
    return {
      statusCode: 405,
      headers: {
        ...buildDefaultHeaders(event.headers?.origin || event.headers?.Origin),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (isCrossSiteRequest(event.headers)) {
    return {
      statusCode: 403,
      headers: {
        ...buildDefaultHeaders(event.headers?.origin || event.headers?.Origin),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Cross-site audio proxy requests are not allowed" }),
    };
  }

  const target = resolveAudioProxyTarget(event.queryStringParameters?.url);
  if (!target) {
    return {
      statusCode: 400,
      headers: {
        ...buildDefaultHeaders(event.headers?.origin || event.headers?.Origin),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Invalid audio URL" }),
    };
  }

  try {
    const upstream = await fetchWithTimeout(target, buildUpstreamHeaders(event.headers?.range || event.headers?.Range));
    if (!isAllowedAudioContentType(upstream.headers.get("content-type"))) {
      return {
        statusCode: 415,
        headers: {
          ...buildDefaultHeaders(event.headers?.origin || event.headers?.Origin),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Upstream response is not an audio stream" }),
      };
    }
    if (isHeadRequest(event.httpMethod)) {
      return {
        statusCode: upstream.status,
        headers: {
          ...buildDefaultHeaders(event.headers?.origin || event.headers?.Origin),
          ...buildNetlifyHeaders(upstream),
        },
        body: "",
        isBase64Encoded: false,
      };
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    return {
      statusCode: upstream.status,
      headers: {
        ...buildDefaultHeaders(event.headers?.origin || event.headers?.Origin),
        ...buildNetlifyHeaders(upstream),
      },
      body: body.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("audio-proxy error", error);
    return {
      statusCode: 502,
      headers: {
        ...buildDefaultHeaders(event.headers?.origin || event.headers?.Origin),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to load upstream audio" }),
    };
  }
}

export async function proxyAudioNetlifyRequest(request) {
  const originHeader = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: buildDefaultHeaders(originHeader),
    });
  }

  if (request.method !== "GET" && !isHeadRequest(request.method)) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...buildDefaultHeaders(originHeader),
        "Content-Type": "application/json",
      },
    });
  }

  if (isCrossSiteRequest({
    "sec-fetch-site": request.headers.get("sec-fetch-site") ?? undefined,
  })) {
    return new Response(JSON.stringify({ error: "Cross-site audio proxy requests are not allowed" }), {
      status: 403,
      headers: {
        ...buildDefaultHeaders(originHeader),
        "Content-Type": "application/json",
      },
    });
  }

  const requestUrl = new URL(request.url);
  const target = resolveAudioProxyTarget(requestUrl.searchParams.get("url"));
  if (!target) {
    return new Response(JSON.stringify({ error: "Invalid audio URL" }), {
      status: 400,
      headers: {
        ...buildDefaultHeaders(originHeader),
        "Content-Type": "application/json",
      },
    });
  }

  try {
    const upstream = await fetchWithTimeout(target, buildUpstreamHeaders(request.headers.get("range") ?? undefined));
    if (!isAllowedAudioContentType(upstream.headers.get("content-type"))) {
      return new Response(JSON.stringify({ error: "Upstream response is not an audio stream" }), {
        status: 415,
        headers: {
          ...buildDefaultHeaders(originHeader),
          "Content-Type": "application/json",
        },
      });
    }

    const headers = {
      ...buildDefaultHeaders(originHeader),
      ...buildNetlifyHeaders(upstream),
    };

    if (isHeadRequest(request.method)) {
      return new Response(null, {
        status: upstream.status,
        headers,
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("audio-proxy error", error);
    return new Response(JSON.stringify({ error: "Failed to load upstream audio" }), {
      status: 502,
      headers: {
        ...buildDefaultHeaders(originHeader),
        "Content-Type": "application/json",
      },
    });
  }
}
