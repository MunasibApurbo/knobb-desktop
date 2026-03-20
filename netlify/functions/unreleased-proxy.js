const ARTISTGRID_ARTIST_SOURCES = [
  "https://assets.artistgrid.cx/artists.ndjson",
  "https://sheets.artistgrid.cx/artists.ndjson",
  "https://git.sad.ovh/sophie/sheets/raw/branch/main/artists.ndjson",
];
const ARTISTGRID_BACKUP_CSV_URL = "https://raw.githubusercontent.com/ArtistGrid/artistgrid-dev/main/public/backup.csv";
const ARTISTGRID_TRENDS_URL = "https://trends.artistgrid.cx";
const ARTISTGRID_TRACKER_BASE_URLS = [
  "https://trackerapi-2.artistgrid.cx",
  "https://tracker.thug.surf",
];

const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  Vary: "Origin",
};

function resolveProxyTarget(queryStringParameters = {}) {
  const resource = queryStringParameters.resource;

  if (resource === "artists") {
    return null;
  }

  if (resource === "trends") {
    return ARTISTGRID_TRENDS_URL;
  }

  if (resource === "tested") {
    return ARTISTGRID_TRACKER_BASE_URLS.map((baseUrl) => `${baseUrl}/tested`);
  }

  if (resource === "tracker") {
    const sheetId = queryStringParameters.sheetId?.trim();
    if (!sheetId || !/^[a-zA-Z0-9_-]+$/.test(sheetId)) {
      return null;
    }

    const tab = queryStringParameters.tab?.trim()?.slice(0, 120);

    return ARTISTGRID_TRACKER_BASE_URLS.map((baseUrl) => {
      const target = new URL(`${baseUrl}/get/${sheetId}`);
      if (tab) {
        target.searchParams.set("tab", tab);
      }
      return target.toString();
    });
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
  let primaryStatus = 502;

  for (const source of ARTISTGRID_ARTIST_SOURCES) {
    try {
      const primary = await fetchWithTimeout(source);
      primaryStatus = primary.status;
      const primaryBody = Buffer.from(await primary.arrayBuffer()).toString("utf8");

      if (primary.ok && primaryBody.trim()) {
        return {
          status: primary.status,
          body: primaryBody,
          contentType: primary.headers.get("content-type") || "application/x-ndjson; charset=utf-8",
        };
      }
    } catch (error) {
      console.warn("unreleased-proxy artists source failed", source, error);
    }
  }

  const backup = await fetchWithTimeout(ARTISTGRID_BACKUP_CSV_URL);
  const backupBody = Buffer.from(await backup.arrayBuffer()).toString("utf8");
  if (!backup.ok || !backupBody.trim()) {
    return {
      status: primaryStatus || backup.status,
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

async function fetchFirstSuccessful(targets, timeoutMs = 10000) {
  const targetList = Array.isArray(targets) ? targets : [targets];
  let lastResponse = null;

  for (const target of targetList) {
    try {
      const response = await fetchWithTimeout(target, timeoutMs);
      lastResponse = response;
      if (response.ok) {
        return response;
      }
    } catch (error) {
      console.warn("unreleased-proxy upstream target failed", target, error);
    }
  }

  return lastResponse;
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
  const resource = event.queryStringParameters?.resource;
  if (resource !== "artists" && !target) {
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

    const upstream = await fetchFirstSuccessful(target);
    if (!upstream) {
      throw new Error("No ArtistGrid upstream responded");
    }
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
