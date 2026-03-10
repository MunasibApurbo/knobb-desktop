const ARTISTGRID_ARTISTS_URL = "https://sheets.artistgrid.cx/artists.ndjson";
const ARTISTGRID_BACKUP_CSV_URL = "https://raw.githubusercontent.com/ArtistGrid/artistgrid-dev/main/public/backup.csv";
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

function parseBackupArtistsCsv(csvText) {
  const lines = csvText.trim().split("\n");
  const artists = [];

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

async function fetchArtistsBody() {
  const primary = await fetchWithTimeout(ARTISTGRID_ARTISTS_URL);
  const primaryBody = Buffer.from(await primary.arrayBuffer()).toString("utf8");

  if (primary.ok && primaryBody.trim()) {
    return {
      status: primary.status,
      body: primaryBody,
      contentType: primary.headers.get("content-type") || "application/x-ndjson; charset=utf-8",
    };
  }

  const backup = await fetchWithTimeout(ARTISTGRID_BACKUP_CSV_URL);
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
    if (event.queryStringParameters?.resource === "artists") {
      const artists = await fetchArtistsBody();

      return {
        statusCode: artists.status,
        headers: {
          ...DEFAULT_HEADERS,
          "Content-Type": artists.contentType,
          "Cache-Control": "public, max-age=300",
        },
        body: artists.body,
      };
    }

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
