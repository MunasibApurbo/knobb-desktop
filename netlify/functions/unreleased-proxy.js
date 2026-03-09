const ARTISTGRID_ARTISTS_URL = "https://sheets.artistgrid.cx/artists.ndjson";
const ARTISTGRID_TRENDS_URL = "https://trends.artistgrid.cx";
const ARTISTGRID_TRACKER_URL = "https://tracker.israeli.ovh/get";

const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  Vary: "Origin",
};

function resolveProxyTarget(queryStringParameters = {}) {
  const resource = queryStringParameters.resource;

  if (resource === "artists") {
    return ARTISTGRID_ARTISTS_URL;
  }

  if (resource === "trends") {
    return ARTISTGRID_TRENDS_URL;
  }

  if (resource === "tracker") {
    const sheetId = queryStringParameters.sheetId?.trim();
    if (!sheetId || !/^[a-zA-Z0-9_-]+$/.test(sheetId)) {
      return null;
    }

    return `${ARTISTGRID_TRACKER_URL}/${sheetId}`;
  }

  return null;
}

async function fetchWithTimeout(target, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(target, { signal: controller.signal });
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

  const target = resolveProxyTarget(event.queryStringParameters);
  if (!target) {
    return {
      statusCode: 400,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Invalid unreleased resource request" }),
    };
  }

  try {
    const upstream = await fetchWithTimeout(target);
    const body = Buffer.from(await upstream.arrayBuffer()).toString("utf8");

    return {
      statusCode: upstream.status,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "public, max-age=300",
      },
      body,
    };
  } catch (error) {
    console.error("unreleased-proxy error", error);

    return {
      statusCode: 502,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Failed to load upstream unreleased data" }),
    };
  }
}
