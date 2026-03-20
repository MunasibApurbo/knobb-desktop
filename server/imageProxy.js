const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  Vary: "Origin",
};

function parseIpv4Address(hostname) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return null;
  }

  const octets = hostname.split(".").map((segment) => Number.parseInt(segment, 10));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return octets;
}

function isBlockedImageHost(hostname) {
  const normalizedHostname = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
  if (!normalizedHostname) {
    return true;
  }

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname.endsWith(".local")
  ) {
    return true;
  }

  const unwrappedHostname = normalizedHostname.startsWith("[") && normalizedHostname.endsWith("]")
    ? normalizedHostname.slice(1, -1)
    : normalizedHostname;
  const ipv4MappedMatch = unwrappedHostname.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  const ipv4Address = parseIpv4Address(ipv4MappedMatch?.[1] || unwrappedHostname);

  if (ipv4Address) {
    const [first, second] = ipv4Address;
    if (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    ) {
      return true;
    }
  }

  if (
    unwrappedHostname === "::1" ||
    unwrappedHostname === "::" ||
    /^fe8/i.test(unwrappedHostname) ||
    /^fe9/i.test(unwrappedHostname) ||
    /^fea/i.test(unwrappedHostname) ||
    /^feb/i.test(unwrappedHostname) ||
    /^fc/i.test(unwrappedHostname) ||
    /^fd/i.test(unwrappedHostname)
  ) {
    return true;
  }

  return false;
}

export function resolveImageProxyTarget(urlValue) {
  if (typeof urlValue !== "string" || !urlValue.trim()) {
    return null;
  }

  try {
    const parsedUrl = new URL(urlValue);
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return null;
    }
    if (isBlockedImageHost(parsedUrl.hostname)) {
      return null;
    }
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(target, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(target, {
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function writeError(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  Object.entries(DEFAULT_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.end(JSON.stringify({ error: message }));
}

export async function proxyImageHttpRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    Object.entries(DEFAULT_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.end("ok");
    return;
  }

  if (req.method !== "GET") {
    writeError(res, 405, "Method not allowed");
    return;
  }

  const requestUrl = new URL(req.url || "/api/image-proxy", "http://localhost");
  const target = resolveImageProxyTarget(requestUrl.searchParams.get("url"));
  if (!target) {
    writeError(res, 400, "Invalid image URL");
    return;
  }

  try {
    const upstream = await fetchWithTimeout(target);
    const body = Buffer.from(await upstream.arrayBuffer());

    res.statusCode = upstream.status;
    Object.entries(DEFAULT_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(body);
  } catch (error) {
    console.error("image proxy error", error);
    writeError(res, 502, "Failed to load upstream image");
  }
}

export async function proxyImageNetlifyEvent(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: "ok",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const target = resolveImageProxyTarget(event.queryStringParameters?.url);
  if (!target) {
    return {
      statusCode: 400,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Invalid image URL" }),
    };
  }

  try {
    const upstream = await fetchWithTimeout(target);
    const body = Buffer.from(await upstream.arrayBuffer());

    return {
      statusCode: upstream.status,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
      body: body.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("image-proxy error", error);
    return {
      statusCode: 502,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to load upstream image" }),
    };
  }
}
