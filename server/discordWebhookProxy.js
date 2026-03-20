const DEFAULT_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const SUPPORTED_DISCORD_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com",
  "ptb.discordapp.com",
  "canary.discordapp.com",
]);

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload),
  };
}

function getHeader(headers, name) {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() !== target) continue;
    return Array.isArray(value) ? value.join(", ") : String(value ?? "");
  }
  return "";
}

function getSupabaseAuthConfig(headers, env) {
  const supabaseUrl = normalizeString(
    env.VITE_SUPABASE_URL || getHeader(headers, "x-knobb-supabase-url"),
    500,
  );
  const publishableKey = normalizeString(
    env.VITE_SUPABASE_PUBLISHABLE_KEY || getHeader(headers, "x-knobb-supabase-key"),
    1000,
  );

  return {
    supabaseUrl,
    publishableKey,
  };
}

function normalizeString(value, maxLength = 280) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeOptionalUrl(value) {
  const candidate = normalizeString(value, 2000);
  if (!candidate) return "";

  try {
    return new URL(candidate).toString();
  } catch {
    return "";
  }
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function truncateTrack(track) {
  if (!track || typeof track !== "object") return null;

  const title = normalizeString(track.title, 180);
  const artist = normalizeString(track.artist, 180);
  if (!title || !artist) return null;

  return {
    title,
    artist,
    album: normalizeString(track.album, 180),
    coverUrl: normalizeOptionalUrl(track.coverUrl),
    shareUrl: normalizeOptionalUrl(track.shareUrl),
    elapsedSeconds: normalizeInteger(track.elapsedSeconds, 0),
    durationSeconds: normalizeInteger(track.durationSeconds, 0),
  };
}

function formatDuration(totalSeconds) {
  const safeTotal = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeTotal / 60);
  const seconds = safeTotal % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildProgressBar(currentTime, duration) {
  if (duration <= 0) return "Live";

  const slots = 10;
  const progress = Math.min(Math.max(currentTime / duration, 0), 1);
  const filledSlots = Math.min(slots, Math.max(0, Math.round(progress * slots)));
  return `${"█".repeat(filledSlots)}${"░".repeat(slots - filledSlots)} ${formatDuration(currentTime)} / ${formatDuration(duration)}`;
}

function buildDiscordMessageBody(track, isPlaying) {
  const statusLabel = isPlaying ? "Playing" : "Paused";
  const descriptionLines = [
    `by **${track.artist}**`,
    track.album ? `Album: **${track.album}**` : "",
    `Progress: ${buildProgressBar(track.elapsedSeconds, track.durationSeconds)}`,
    track.shareUrl ? `[Open in Knobb](${track.shareUrl})` : "",
  ].filter(Boolean);

  const embed = {
    title: track.title,
    description: descriptionLines.join("\n"),
    footer: {
      text: `Knobb web sharing • ${statusLabel}`,
    },
    timestamp: new Date().toISOString(),
  };

  if (track.shareUrl) {
    embed.url = track.shareUrl;
  }

  if (track.coverUrl) {
    embed.thumbnail = { url: track.coverUrl };
  }

  return {
    allowed_mentions: { parse: [] },
    content: isPlaying ? "Now playing from Knobb" : "Playback paused in Knobb",
    embeds: [embed],
  };
}

function getDiscordWebhookApiBase(webhookUrl) {
  const candidate = normalizeString(webhookUrl, 2000);
  if (!candidate) {
    throw new Error("Discord webhook URL is required.");
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("Discord webhook URL is invalid.");
  }

  if (!SUPPORTED_DISCORD_HOSTS.has(parsed.hostname)) {
    throw new Error("Only Discord webhook URLs are supported.");
  }

  const match = parsed.pathname.match(/^\/api(?:\/v\d+)?\/webhooks\/([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error("Discord webhook URL is invalid.");
  }

  const versionPrefix = parsed.pathname.startsWith("/api/v")
    ? parsed.pathname.split("/webhooks/")[0]
    : "/api";

  return `${parsed.origin}${versionPrefix}/webhooks/${match[1]}/${match[2]}`;
}

async function parseJsonBody(bodyText) {
  const body = String(bodyText || "").trim();
  if (!body) return {};

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function verifySupabaseUser(headers, env, fetchImpl) {
  const authorization = getHeader(headers, "authorization");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return null;
  }

  const { supabaseUrl, publishableKey } = getSupabaseAuthConfig(headers, env);
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase auth environment is not configured.");
  }

  const response = await fetchImpl(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: publishableKey,
    },
  });

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function validateDiscordWebhook(webhookApiBase, fetchImpl) {
  const response = await fetchImpl(webhookApiBase);
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(`Discord webhook validation failed with status ${response.status}.`);
  }

  return {
    name: normalizeString(payload?.name, 120),
  };
}

async function createDiscordWebhookMessage(webhookApiBase, body, fetchImpl) {
  const response = await fetchImpl(`${webhookApiBase}?wait=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(`Discord webhook update failed with status ${response.status}.`);
  }

  return normalizeString(payload?.id, 80);
}

async function updateDiscordWebhookMessage(webhookApiBase, messageId, body, fetchImpl) {
  const safeMessageId = normalizeString(messageId, 80);
  if (!safeMessageId) return "";

  const response = await fetchImpl(`${webhookApiBase}/messages/${encodeURIComponent(safeMessageId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 404) {
    return "";
  }

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(`Discord webhook update failed with status ${response.status}.`);
  }

  return normalizeString(payload?.id, 80) || safeMessageId;
}

async function clearDiscordWebhookMessage(webhookApiBase, messageId, fetchImpl) {
  const safeMessageId = normalizeString(messageId, 80);
  if (!safeMessageId) return;

  const response = await fetchImpl(`${webhookApiBase}/messages/${encodeURIComponent(safeMessageId)}`, {
    method: "DELETE",
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Discord webhook clear failed with status ${response.status}.`);
  }
}

export async function handleDiscordWebhookRequest({
  method,
  headers,
  bodyText,
  env = process.env,
  fetchImpl = fetch,
}) {
  if (method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const user = await verifySupabaseUser(headers, env, fetchImpl);
    if (!user?.id) {
      return jsonResponse(401, { error: "Authentication required." });
    }

    const payload = await parseJsonBody(bodyText);
    const action = normalizeString(payload.action, 32);
    const webhookApiBase = getDiscordWebhookApiBase(payload.webhookUrl);

    if (action === "test") {
      const result = await validateDiscordWebhook(webhookApiBase, fetchImpl);
      return jsonResponse(200, { ok: true, name: result.name || null });
    }

    if (action === "clear") {
      await clearDiscordWebhookMessage(webhookApiBase, payload.messageId, fetchImpl);
      return jsonResponse(200, { ok: true, messageId: null });
    }

    if (action === "sync") {
      const track = truncateTrack(payload.track);
      if (!track) {
        return jsonResponse(400, { error: "Track metadata is required." });
      }

      const body = buildDiscordMessageBody(track, payload.isPlaying !== false);
      const existingMessageId = normalizeString(payload.messageId, 80);
      const updatedMessageId = existingMessageId
        ? await updateDiscordWebhookMessage(webhookApiBase, existingMessageId, body, fetchImpl)
        : "";
      const messageId = updatedMessageId || await createDiscordWebhookMessage(webhookApiBase, body, fetchImpl);

      return jsonResponse(200, { ok: true, messageId: messageId || null });
    }

    return jsonResponse(400, { error: "Unsupported Discord webhook action." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discord webhook request failed.";
    return jsonResponse(500, { error: message });
  }
}

async function readNodeRequestBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

export async function proxyDiscordWebhookHttpRequest(req, res) {
  const response = await handleDiscordWebhookRequest({
    method: req.method || "GET",
    headers: req.headers || {},
    bodyText: await readNodeRequestBody(req),
    env: process.env,
    fetchImpl: fetch,
  });

  res.statusCode = response.statusCode;
  for (const [header, value] of Object.entries(response.headers)) {
    res.setHeader(header, value);
  }
  res.end(response.body);
}
