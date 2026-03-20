const TIDAL_BROWSE_BASE_URL = "https://api.tidal.com/v1";
const TIDAL_V2_TOKEN = "txNoH4kkV41MfH25";

const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  Vary: "Origin",
};

function isValidPath(value) {
  return typeof value === "string" && (
    /^pages(?:\/[A-Za-z0-9._-]+)+$/.test(value) ||
    value === "genres" ||
    /^genres\/[A-Za-z0-9._-]+$/.test(value) ||
    /^(albums|artists|playlists|tracks|videos)\/[A-Za-z0-9._-]+$/.test(value)
  );
}

function isValidCountryCode(value) {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

function isValidLocale(value) {
  return typeof value === "string" && /^[a-z]{2}_[A-Z]{2}$/.test(value);
}

function isValidDeviceType(value) {
  return typeof value === "string" && /^[A-Z_]+$/.test(value);
}

function isValidNumberToken(value) {
  return typeof value === "string" && /^\d+$/.test(value);
}

function buildUpstreamUrl(queryStringParameters = {}) {
  const path = queryStringParameters.path?.trim();
  if (!isValidPath(path)) {
    return null;
  }

  const isPagesPath = /^pages(?:\/[A-Za-z0-9._-]+)+$/.test(path);

  const params = new URLSearchParams();
  const locale = queryStringParameters.locale?.trim();
  const countryCode = queryStringParameters.countryCode?.trim();
  const deviceType = queryStringParameters.deviceType?.trim();
  const limit = queryStringParameters.limit?.trim();
  const offset = queryStringParameters.offset?.trim();
  const filterId = queryStringParameters.filterId?.trim();

  params.set("locale", isValidLocale(locale) ? locale : "en_US");
  params.set("countryCode", isValidCountryCode(countryCode) ? countryCode : "US");

  if (isPagesPath) {
    params.set("deviceType", isValidDeviceType(deviceType) ? deviceType : "BROWSER");
  }

  if (isValidNumberToken(limit)) {
    params.set("limit", limit);
  }

  if (isValidNumberToken(offset)) {
    params.set("offset", offset);
  }

  if (typeof filterId === "string" && /^[A-Za-z0-9._-]+$/.test(filterId)) {
    params.set("filter[id]", filterId);
  }

  return `${TIDAL_BROWSE_BASE_URL}/${path}?${params.toString()}`;
}

async function fetchWithTimeout(target, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(target, {
      signal: controller.signal,
      headers: {
        "X-Tidal-Token": TIDAL_V2_TOKEN,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function handler(event) {
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

  const target = buildUpstreamUrl(event.queryStringParameters);
  if (!target) {
    return {
      statusCode: 400,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Invalid TIDAL browse path" }),
    };
  }

  try {
    const upstream = await fetchWithTimeout(target);
    const body = Buffer.from(await upstream.arrayBuffer()).toString("utf8");

    return {
      statusCode: upstream.status,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
      body,
    };
  } catch (error) {
    console.error("tidal-browse-proxy error", error);

    return {
      statusCode: 502,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to load upstream TIDAL browse data" }),
    };
  }
}
