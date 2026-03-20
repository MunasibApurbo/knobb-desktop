import { execFile } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { promisify } from "node:util";

const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Range",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
  Vary: "Origin",
};

const AUDIO_FALLBACK_DURATION_SECONDS = 0;
const CACHE_CONTROL = "public, max-age=60";
const PLAYBACK_CACHE_TTL_MS = 1000 * 60;
const YOUTUBE_REQUEST_TIMEOUT_MS = 8000;
const YOUTUBE_THUMBNAIL_TARGET_LONGEST_EDGE = 1200;
const YOUTUBE_LYRICS_FALLBACK_BASE_URL = "https://lyrics.lewdhutao.my.eu.org";
const LRCLIB_BASE_URL = "https://lrclib.net";
const VALID_ACTIONS = new Set([
  "search",
  "lyrics",
  "playback",
  "stream",
  "video-playback",
  "video-stream",
  "video-audio-stream",
  "video-fallback-stream",
]);

let lightweightClientPromise = null;
let playbackClientPromise = null;
let innertubeModulePromise = null;
const playbackSourceCache = new Map();
const playbackResolutionRequests = new Map();
const execFileAsync = promisify(execFile);
let ytDlpExecutablePromise = null;
const invalidRuntimeConfigWarnings = new Set();
const bundledYtDlpCandidates = process.platform === "linux"
  ? [
      path.resolve(process.cwd(), "bin", "yt-dlp_linux"),
    ]
  : [];
const bundledCookieFileCandidates = process.platform === "linux"
  ? [
      path.resolve(process.cwd(), "netlify", "cookies", "ytmusic-cookies.txt"),
    ]
  : [];
const STAGED_YT_DLP_DIRECTORY = process.platform === "linux"
  ? path.join("/tmp", "knobb-tools")
  : "";
const STAGED_YT_DLP_PATH = STAGED_YT_DLP_DIRECTORY
  ? path.join(STAGED_YT_DLP_DIRECTORY, "yt-dlp_linux")
  : "";
const STAGED_YT_DLP_COOKIE_PATH = STAGED_YT_DLP_DIRECTORY
  ? path.join(STAGED_YT_DLP_DIRECTORY, "yt-dlp-cookies.txt")
  : "";
const YT_DLP_BASE_ARGS = [
  "--js-runtimes",
  "node",
];

async function loadInnertube() {
  if (!innertubeModulePromise) {
    innertubeModulePromise = import("youtubei.js");
  }

  return innertubeModulePromise;
}

function getConfiguredCookie() {
  return getSafeHeaderConfigValue(
    "YTMUSIC_COOKIE",
    process.env.YTMUSIC_COOKIE ||
    process.env.YTM_COOKIE ||
    process.env.YOUTUBE_MUSIC_COOKIE ||
    "",
  );
}

function getConfiguredCookieFilePath() {
  const configuredPath = (
    process.env.YTMUSIC_COOKIE_FILE ||
    process.env.YTM_COOKIE_FILE ||
    process.env.YOUTUBE_MUSIC_COOKIE_FILE ||
    ""
  ).trim();

  if (configuredPath) {
    return configuredPath;
  }

  return bundledCookieFileCandidates.find((candidate) => existsSync(candidate)) || "";
}

function getConfiguredVisitorData() {
  return getSafeHeaderConfigValue(
    "YTMUSIC_VISITOR_DATA",
    process.env.YTMUSIC_VISITOR_DATA ||
    process.env.YTM_VISITOR_DATA ||
    "",
  );
}

function getConfiguredPoToken() {
  return getSafeHeaderConfigValue(
    "YTMUSIC_PO_TOKEN",
    process.env.YTMUSIC_PO_TOKEN ||
    process.env.YTM_PO_TOKEN ||
    "",
  );
}

function isByteStringSafe(value) {
  if (typeof value !== "string") {
    return true;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 255) {
      return false;
    }
  }

  return true;
}

function getSafeHeaderConfigValue(label, rawValue) {
  const normalized = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!normalized) {
    return "";
  }

  if (isByteStringSafe(normalized)) {
    return normalized;
  }

  if (!invalidRuntimeConfigWarnings.has(label)) {
    invalidRuntimeConfigWarnings.add(label);
    console.warn(
      `${label} contains non-Latin1 characters and will be ignored. Re-copy the full value without typographic ellipses or smart quotes.`,
    );
  }

  return "";
}

function looksLikeNetscapeCookieFile(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return normalized.startsWith("# Netscape HTTP Cookie File")
    || /\n[^\n]+\t(?:TRUE|FALSE)\t[^\n]*\t(?:TRUE|FALSE)\t\d+\t[^\n]+\t[^\n]+/.test(normalized);
}

function ensureStagedYtDlpDirectory() {
  if (!STAGED_YT_DLP_DIRECTORY) {
    return false;
  }
  mkdirSync(STAGED_YT_DLP_DIRECTORY, { recursive: true });
  return true;
}

function stageConfiguredCookieFile(cookieValue) {
  if (!STAGED_YT_DLP_COOKIE_PATH || !looksLikeNetscapeCookieFile(cookieValue)) {
    return null;
  }

  if (!ensureStagedYtDlpDirectory()) {
    return null;
  }

  const normalized = cookieValue.trim().endsWith("\n")
    ? cookieValue.trim()
    : `${cookieValue.trim()}\n`;
  writeFileSync(STAGED_YT_DLP_COOKIE_PATH, normalized, { encoding: "utf8", mode: 0o600 });
  return STAGED_YT_DLP_COOKIE_PATH;
}

function stageCookieFilePath(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return null;
  }

  if (!STAGED_YT_DLP_COOKIE_PATH) {
    return filePath;
  }

  if (!ensureStagedYtDlpDirectory()) {
    return filePath;
  }

  copyFileSync(filePath, STAGED_YT_DLP_COOKIE_PATH);
  chmodSync(STAGED_YT_DLP_COOKIE_PATH, 0o600);
  return STAGED_YT_DLP_COOKIE_PATH;
}

async function buildYtDlpAuthArgs() {
  const explicitCookieFile = getConfiguredCookieFilePath();
  if (explicitCookieFile && existsSync(explicitCookieFile)) {
    return ["--cookies", stageCookieFilePath(explicitCookieFile) || explicitCookieFile];
  }

  const cookieValue = getConfiguredCookie();
  if (!cookieValue) {
    return [];
  }

  const stagedCookieFile = stageConfiguredCookieFile(cookieValue);
  if (stagedCookieFile) {
    return ["--cookies", stagedCookieFile];
  }

  return ["--add-headers", `Cookie:${cookieValue}`];
}

function enhanceYtDlpError(error) {
  const message = getErrorMessage(error);
  if (!message) {
    return error instanceof Error ? error : new Error("yt-dlp request failed");
  }

  const missingCookieConfig = !getConfiguredCookie() && !getConfiguredCookieFilePath();
  if (
    missingCookieConfig
    && /sign in to confirm you(?:'|’)re not a bot/i.test(message)
  ) {
    return new Error(
      `${message} Configure YTMUSIC_COOKIE or YTMUSIC_COOKIE_FILE in the Netlify runtime environment and redeploy.`,
    );
  }

  return error instanceof Error ? error : new Error(message);
}

function getCachedPlaybackSource(cacheKey) {
  const cached = playbackSourceCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    playbackSourceCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function setCachedPlaybackSource(cacheKey, value) {
  playbackSourceCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + PLAYBACK_CACHE_TTL_MS,
  });
}

function getPlaybackCacheKey(id, { preferVideo = false, quality = "" } = {}) {
  const normalizedQuality = typeof quality === "string" ? quality.trim().toUpperCase() : "";
  return `${preferVideo ? "video" : "audio"}:${normalizedQuality || "default"}:${id}`;
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error || "");
}

function shouldRefreshYoutubeClient(error) {
  const normalized = getErrorMessage(error).trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes("player") ||
    normalized.includes("signature") ||
    normalized.includes("decipher") ||
    normalized.includes("nsig") ||
    normalized.includes("po token") ||
    normalized.includes("streaming data not available")
  );
}

function normalizeVideoQuality(value) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === "480P" || normalized === "720P" || normalized === "1080P") {
    return normalized;
  }
  return "AUTO";
}

function getVideoHeightCap(quality) {
  switch (normalizeVideoQuality(quality)) {
    case "480P":
      return 480;
    case "720P":
      return 720;
    case "1080P":
      return 1080;
    case "AUTO":
    default:
      return null;
  }
}

function shouldPreferHlsForVideo(quality) {
  switch (normalizeVideoQuality(quality)) {
    case "480P":
    case "720P":
      return true;
    case "AUTO":
    case "1080P":
    default:
      return false;
  }
}

export function buildYtDlpVideoFormatSelector(quality) {
  const maxHeight = getVideoHeightCap(quality);
  if (maxHeight === null) {
    return [
      "bestvideo[vcodec^=avc1]+bestaudio",
      "bestvideo[vcodec^=avc1][ext=mp4]+bestaudio",
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]",
      "bestvideo+bestaudio",
      "best[ext=mp4][vcodec^=avc1][acodec!=none]",
      "best[ext=mp4][vcodec!=none][acodec!=none]",
      "best[vcodec!=none][acodec!=none]",
    ].join("/");
  }

  return [
    `bestvideo[vcodec^=avc1][height<=${maxHeight}]+bestaudio`,
    `bestvideo[vcodec^=avc1][height<=${maxHeight}][ext=mp4]+bestaudio`,
    `bestvideo[height<=${maxHeight}][ext=mp4]+bestaudio[ext=m4a]`,
    `bestvideo[height<=${maxHeight}]+bestaudio`,
    `best[height<=${maxHeight}][ext=mp4][vcodec^=avc1][acodec!=none]`,
    `best[height<=${maxHeight}][ext=mp4][vcodec!=none][acodec!=none]`,
    `best[height<=${maxHeight}][vcodec!=none][acodec!=none]`,
    "best[ext=mp4][vcodec^=avc1][acodec!=none]",
    "best[ext=mp4][vcodec!=none][acodec!=none]",
    "best[vcodec!=none][acodec!=none]",
  ].join("/");
}

function buildYtDlpAudioFormatSelector(quality) {
  const preferredFormats =
    quality === "LOW"
      ? ["139", "249", "140", "250", "bestaudio"]
      : quality === "MEDIUM"
        ? ["140", "250", "139", "249", "251", "bestaudio"]
        : ["140", "141", "251", "250", "249", "139", "bestaudio"];

  return [
    ...preferredFormats,
    "best[acodec!=none][vcodec=none]",
    "best[acodec!=none]",
    "best",
  ].join("/");
}

function resetYoutubeMusicClient() {
  lightweightClientPromise = null;
  playbackClientPromise = null;
}

async function getYoutubeMusicClient(options = {}) {
  if (options.forceRefresh === true) {
    resetYoutubeMusicClient();
  }

  const retrievePlayer = options.retrievePlayer === true;
  const cachedClientPromise = retrievePlayer ? playbackClientPromise : lightweightClientPromise;
  if (!cachedClientPromise) {
    const nextClientPromise = loadInnertube().then(({ Innertube }) =>
      Innertube.create({
        lang: "en",
        location: "US",
        client_type: "YTMUSIC",
        retrieve_player: retrievePlayer,
        generate_session_locally: true,
        cookie: getConfiguredCookie() || undefined,
        visitor_data: getConfiguredVisitorData() || undefined,
        po_token: getConfiguredPoToken() || undefined,
      }),
    );

    if (retrievePlayer) {
      playbackClientPromise = nextClientPromise;
    } else {
      lightweightClientPromise = nextClientPromise;
    }
  }

  return retrievePlayer ? playbackClientPromise : lightweightClientPromise;
}

function toPlainText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.text === "string") return value.text;
  if (Array.isArray(value.runs)) {
    return value.runs
      .map((entry) => (typeof entry?.text === "string" ? entry.text : ""))
      .join("")
      .trim();
  }
  if (typeof value.toString === "function") {
    const stringified = value.toString().trim();
    if (stringified && stringified !== "[object Object]") {
      return stringified;
    }
  }
  return "";
}

function buildEnhancedThumbnailDimensions(thumbnail) {
  const width = Number.isFinite(thumbnail?.width) ? thumbnail.width : 0;
  const height = Number.isFinite(thumbnail?.height) ? thumbnail.height : 0;

  if (width > 0 && height > 0) {
    const scale = Math.max(1, YOUTUBE_THUMBNAIL_TARGET_LONGEST_EDGE / Math.max(width, height));
    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };
  }

  return {
    width: YOUTUBE_THUMBNAIL_TARGET_LONGEST_EDGE,
    height: YOUTUBE_THUMBNAIL_TARGET_LONGEST_EDGE,
  };
}

function enhanceYoutubeThumbnailUrl(thumbnail) {
  const url = typeof thumbnail?.url === "string" ? thumbnail.url : "";
  if (!url) return null;

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return url;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!hostname.includes("googleusercontent.com") && !hostname.includes("ggpht.com")) {
    return url;
  }

  const lastEqualsIndex = url.lastIndexOf("=");
  if (lastEqualsIndex === -1 || lastEqualsIndex === url.length - 1) {
    return url;
  }

  const baseUrl = url.slice(0, lastEqualsIndex + 1);
  const formatDescriptor = url.slice(lastEqualsIndex + 1);
  const { width, height } = buildEnhancedThumbnailDimensions(thumbnail);

  const upgradedDescriptor = formatDescriptor
    .replace(/w\d+/i, `w${width}`)
    .replace(/h\d+/i, `h${height}`)
    .replace(/s\d+/i, `s${Math.max(width, height)}`);

  return upgradedDescriptor !== formatDescriptor ? `${baseUrl}${upgradedDescriptor}` : url;
}

function pickBestThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
  const sorted = [...thumbnails].sort((left, right) => {
    const leftArea = (left?.width || 0) * (left?.height || 0);
    const rightArea = (right?.width || 0) * (right?.height || 0);
    return rightArea - leftArea;
  });
  return enhanceYoutubeThumbnailUrl(sorted[0]);
}

function parseDurationText(value) {
  if (typeof value !== "string" || !value.includes(":")) {
    return AUDIO_FALLBACK_DURATION_SECONDS;
  }

  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) {
    return AUDIO_FALLBACK_DURATION_SECONDS;
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
}

function getTrackDurationText(item) {
  if (typeof item?.length_text === "string" && item.length_text.trim()) {
    return item.length_text.trim();
  }

  return item?.duration?.text || item?.basic_info?.duration || "";
}

function normalizeSourceId(id) {
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function buildYoutubeWatchUrl(id) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

function buildStreamProxyUrl(action, id, quality = "") {
  const searchParams = new URLSearchParams({
    action,
    id,
  });

  if (quality) {
    searchParams.set("quality", quality);
  }

  return `/api/youtube-music?${searchParams.toString()}`;
}

function buildPlaybackStreamProxyUrl(id, quality = "") {
  return buildStreamProxyUrl("stream", id, quality);
}

function buildVideoPlaybackStreamProxyUrl(id, quality = "") {
  return buildStreamProxyUrl("video-stream", id, quality);
}

function buildVideoPlaybackAudioStreamProxyUrl(id, quality = "") {
  return buildStreamProxyUrl("video-audio-stream", id, quality);
}

function buildVideoPlaybackFallbackStreamProxyUrl(id, quality = "") {
  return buildStreamProxyUrl("video-fallback-stream", id, quality);
}

async function hasYtDlpBinary() {
  return Boolean(await getYtDlpExecutable());
}

async function getYtDlpExecutable() {
  if (!ytDlpExecutablePromise) {
    ytDlpExecutablePromise = (async () => {
      const bundledExecutable = stageBundledYtDlpExecutable();
      const candidates = [
        process.env.YT_DLP_BINARY?.trim(),
        process.env.YTDLP_BINARY?.trim(),
        bundledExecutable,
        "yt-dlp",
      ].filter(Boolean);

      for (const candidate of candidates) {
        if (candidate !== "yt-dlp" && existsSync(candidate)) {
          return candidate;
        }

        try {
          await execFileAsync(candidate, ["--version"], {
            timeout: 4000,
          });
          return candidate;
        } catch {
          // Try the next candidate until one works.
        }
      }

      return null;
    })();
  }

  return ytDlpExecutablePromise;
}

function stageBundledYtDlpExecutable() {
  if (!STAGED_YT_DLP_PATH) {
    return null;
  }

  const sourcePath = bundledYtDlpCandidates.find((candidate) => existsSync(candidate));
  if (!sourcePath) {
    return null;
  }

  ensureStagedYtDlpDirectory();
  copyFileSync(sourcePath, STAGED_YT_DLP_PATH);
  chmodSync(STAGED_YT_DLP_PATH, 0o755);
  return STAGED_YT_DLP_PATH;
}


function getInnertubeVideoQualityAttempts(quality) {
  switch (normalizeVideoQuality(quality)) {
    case "480P":
      return ["480p", "360p", "best"];
    case "720P":
      return ["720p", "480p", "360p", "best"];
    case "1080P":
      return ["1080p", "720p", "480p", "best"];
    case "AUTO":
    default:
      return ["2160p", "1440p", "1080p", "720p", "480p", "best"];
  }
}

function getInnertubeAudioOptions(quality) {
  return {
    type: "audio",
    quality: quality === "LOW" || quality === "MEDIUM" ? "bestefficiency" : "best",
    format: "mp4",
  };
}

async function runYtDlpJson(args) {
  const executable = await getYtDlpExecutable();
  if (!executable) {
    throw new Error("yt-dlp is not available");
  }

  const authArgs = await buildYtDlpAuthArgs();
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(executable, [...YT_DLP_BASE_ARGS, ...authArgs, ...args], {
      maxBuffer: 1024 * 1024 * 16,
      timeout: 10000,
    }));
  } catch (error) {
    throw enhanceYtDlpError(error);
  }

  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const payload = lines[lines.length - 1];
  if (!payload) {
    throw new Error("yt-dlp returned no JSON payload");
  }

  return JSON.parse(payload);
}

function pickRequestedFormat(payload, predicate) {
  if (Array.isArray(payload?.requested_formats)) {
    const requested = payload.requested_formats.find(predicate);
    if (requested) return requested;
  }

  if (predicate(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.formats)) {
    return payload.formats.find(predicate) || null;
  }

  return null;
}

function buildDirectPlaybackSourceFromYtDlpFormat(format) {
  if (!format || typeof format.url !== "string" || !format.url) return null;

  return {
    ...getPlaybackMetadataFromFormat(format),
    ...(buildAudioQualityLabelFromFormat(format)
      ? { audioQualityLabel: buildAudioQualityLabelFromFormat(format) }
      : {}),
    url: format.url,
    type: "direct",
  };
}

function buildAvailableAudioQualityLabelsFromFormats(formats) {
  const candidates = Array.isArray(formats) ? formats : [];
  const uniqueLabels = [];
  const seenLabels = new Set();

  const sortedAudioFormats = candidates
    .filter((entry) => (
      typeof entry?.url === "string"
      && entry.url
      && entry.acodec !== "none"
      && (entry.vcodec === "none" || !entry.vcodec)
    ))
    .sort((left, right) => {
      const bitrateDelta = (getAudioBitrateKbpsFromFormat(right) || 0) - (getAudioBitrateKbpsFromFormat(left) || 0);
      if (bitrateDelta !== 0) {
        return bitrateDelta;
      }

      const codecLeft = normalizeAudioCodecLabel(left?.acodec || parseCodecFromMimeType(left?.mime_type || left?.mimeType)) || "";
      const codecRight = normalizeAudioCodecLabel(right?.acodec || parseCodecFromMimeType(right?.mime_type || right?.mimeType)) || "";
      return codecRight.localeCompare(codecLeft);
    });

  for (const format of sortedAudioFormats) {
    const label = buildAudioQualityLabelFromFormat(format);
    if (!label || seenLabels.has(label)) {
      continue;
    }

    seenLabels.add(label);
    uniqueLabels.push(label);
  }

  return uniqueLabels.length > 0 ? uniqueLabels : null;
}

function getPlaybackMetadataFromFormat(format) {
  if (!format || typeof format !== "object") {
    return {};
  }

  return {
    ...(Number.isFinite(Number(format?.height)) && Number(format.height) > 0
      ? { videoHeight: Number(format.height) }
      : {}),
  };
}

function parseCodecFromMimeType(mimeType) {
  if (typeof mimeType !== "string" || !mimeType) {
    return "";
  }

  const match = mimeType.match(/codecs="([^"]+)"/i);
  if (!match) {
    return "";
  }

  return match[1]
    .split(",")
    .map((part) => part.trim())
    .find(Boolean) || "";
}

function normalizeAudioCodecLabel(codec) {
  const normalized = typeof codec === "string" ? codec.trim().toLowerCase() : "";
  if (!normalized || normalized === "none") {
    return null;
  }

  if (normalized.startsWith("mp4a") || normalized.includes("aac")) return "AAC";
  if (normalized.includes("opus")) return "Opus";
  if (normalized.includes("vorbis")) return "Vorbis";
  if (normalized.includes("flac")) return "FLAC";
  if (normalized.startsWith("ec-3") || normalized.includes("eac3")) return "E-AC-3";
  if (normalized.startsWith("ac-3") || normalized.includes("ac3")) return "AC-3";
  if (normalized.startsWith("mp3")) return "MP3";

  return codec.trim();
}

function normalizeAudioBitrateKbps(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return numericValue > 1000 ? numericValue / 1000 : numericValue;
}

function getAudioBitrateKbpsFromFormat(format) {
  if (!format || typeof format !== "object") {
    return null;
  }

  const candidates = [
    format.abr,
    format.audioBitrate,
    format.audio_bitrate,
    format.audio_bitrate_kbps,
    format.audioBitrateKbps,
    format.bitrate,
    format.average_bitrate,
    format.avg_bitrate,
    format.tbr,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAudioBitrateKbps(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function buildAudioQualityLabelFromFormat(format) {
  if (!format || typeof format !== "object") {
    return null;
  }

  const codec = normalizeAudioCodecLabel(
    typeof format.acodec === "string" && format.acodec
      ? format.acodec
      : parseCodecFromMimeType(format.mime_type || format.mimeType),
  );
  const bitrateKbps = getAudioBitrateKbpsFromFormat(format);
  const roundedBitrate = bitrateKbps !== null ? Math.round(bitrateKbps) : null;

  if (codec && roundedBitrate) {
    return `${codec} ${roundedBitrate} kbps`;
  }

  if (roundedBitrate) {
    return `${roundedBitrate} kbps`;
  }

  return codec;
}

function buildCompatibleMuxedPlaybackSource(payload, quality = "") {
  const maxHeight = getVideoHeightCap(quality);
  const candidates = Array.isArray(payload?.formats) ? payload.formats : [];

  const muxedFormat = candidates
    .filter((entry) => (
      typeof entry?.url === "string"
      && entry.url
      && entry.vcodec !== "none"
      && entry.acodec !== "none"
      && (maxHeight === null || (Number(entry?.height) || 0) <= maxHeight)
    ))
    .sort((left, right) => {
      const codecPreferenceDelta = getVideoCodecPreference(right) - getVideoCodecPreference(left);
      if (codecPreferenceDelta !== 0) {
        return codecPreferenceDelta;
      }

      const heightDelta = (Number(right?.height) || 0) - (Number(left?.height) || 0);
      if (heightDelta !== 0) {
        return heightDelta;
      }

      return (Number(right?.tbr) || 0) - (Number(left?.tbr) || 0);
    })[0];

  return buildDirectPlaybackSourceFromYtDlpFormat(muxedFormat);
}

function getVideoCodecPreference(format) {
  const codec = typeof format?.vcodec === "string" ? format.vcodec.toLowerCase() : "";
  const ext = typeof format?.ext === "string" ? format.ext.toLowerCase() : "";

  if (codec.startsWith("avc1") && ext === "mp4") return 5;
  if (codec.startsWith("avc1")) return 4;
  if (ext === "mp4") return 3;
  if (codec.startsWith("av01")) return 2;
  if (codec.startsWith("vp9")) return 1;
  return 0;
}

function getAudioCodecPreference(format) {
  const codec = normalizeAudioCodecLabel(
    typeof format?.acodec === "string" && format.acodec
      ? format.acodec
      : parseCodecFromMimeType(format?.mime_type || format?.mimeType),
  );

  if (codec === "Opus") return 3;
  if (codec === "AAC") return 2;
  if (codec === "Vorbis") return 1;
  return 0;
}

export function buildSplitDirectPlaybackSource(payload, quality = "") {
  const requestedFormats = [
    ...(Array.isArray(payload?.requested_formats) ? payload.requested_formats : []),
    ...((Array.isArray(payload?.requested_downloads) ? payload.requested_downloads : [])
      .flatMap((download) => Array.isArray(download?.requested_formats) ? download.requested_formats : [])),
  ];

  const videoFormat = requestedFormats
    .filter((entry) => typeof entry?.url === "string" && entry.url && entry.vcodec !== "none")
    .sort((left, right) => {
      const codecPreferenceDelta = getVideoCodecPreference(right) - getVideoCodecPreference(left);
      if (codecPreferenceDelta !== 0) {
        return codecPreferenceDelta;
      }

      const heightDelta = (Number(right?.height) || 0) - (Number(left?.height) || 0);
      if (heightDelta !== 0) {
        return heightDelta;
      }

      return (Number(right?.tbr) || 0) - (Number(left?.tbr) || 0);
    })[0];
  const audioFormat = requestedFormats
    .filter((entry) => typeof entry?.url === "string" && entry.url && entry.acodec !== "none" && entry.vcodec === "none")
    .sort((left, right) => {
      const bitrateDelta = (getAudioBitrateKbpsFromFormat(right) || 0) - (getAudioBitrateKbpsFromFormat(left) || 0);
      if (bitrateDelta !== 0) {
        return bitrateDelta;
      }

      return getAudioCodecPreference(right) - getAudioCodecPreference(left);
    })[0];

  if (!videoFormat || !audioFormat) {
    return null;
  }

  const compatibleMuxedSource = buildCompatibleMuxedPlaybackSource(payload, quality);
  const availableAudioQualityLabels = buildAvailableAudioQualityLabelsFromFormats(
    Array.isArray(payload?.formats) && payload.formats.length > 0
      ? payload.formats
      : requestedFormats,
  );

  return {
    ...(availableAudioQualityLabels ? { availableAudioQualityLabels } : {}),
    ...(Number.isFinite(Number(videoFormat?.height)) && Number(videoFormat.height) > 0
      ? { videoHeight: Number(videoFormat.height) }
      : {}),
    ...(buildAudioQualityLabelFromFormat(audioFormat)
      ? { audioQualityLabel: buildAudioQualityLabelFromFormat(audioFormat) }
      : {}),
    url: videoFormat.url,
    audioUrl: audioFormat.url,
    ...(compatibleMuxedSource?.url ? { fallbackUrl: compatibleMuxedSource.url } : {}),
    ...(Number.isFinite(Number(compatibleMuxedSource?.videoHeight)) && Number(compatibleMuxedSource.videoHeight) > 0
      ? { fallbackVideoHeight: Number(compatibleMuxedSource.videoHeight) }
      : {}),
    type: "direct",
  };
}

async function resolvePlaybackWithInnertubeStreamingData(yt, id, { preferVideo = false, quality = "" } = {}) {
  const normalizedQuality = typeof quality === "string" ? quality.trim().toUpperCase() : "";
  const cacheKey = getPlaybackCacheKey(id, { preferVideo, quality: normalizedQuality });
  const cached = getCachedPlaybackSource(cacheKey);
  if (cached) return cached;

  if (!yt || typeof yt.getStreamingData !== "function") {
    return null;
  }

  const attempts = preferVideo
    ? getInnertubeVideoQualityAttempts(normalizedQuality).map((candidateQuality) => ({
      quality: candidateQuality,
      format: "mp4",
    }))
    : [
      getInnertubeAudioOptions(normalizedQuality),
      {
        type: "audio",
        quality: normalizedQuality === "LOW" || normalizedQuality === "MEDIUM" ? "bestefficiency" : "best",
        format: "any",
      },
    ];

  for (const attempt of attempts) {
    try {
      const format = await yt.getStreamingData(id, attempt);
      const resolved = buildDirectPlaybackSourceFromYtDlpFormat(format);
      if (!resolved) continue;
      setCachedPlaybackSource(cacheKey, resolved);
      return resolved;
    } catch {
      // Try the next pure-JS fallback variant.
    }
  }

  return null;
}

async function getPlaybackInfo(yt, id) {
  const attempts = [
    {
      label: "YouTube Music track info",
      run: () => yt.music.getInfo(id),
    },
    {
      label: "YouTube basic track info",
      run: () => yt.getBasicInfo(id),
    },
    {
      label: "YouTube full track info",
      run: () => yt.getInfo(id),
    },
  ];

  let refreshSuggested = false;
  let lastError = null;

  for (const attempt of attempts) {
    try {
      const info = await withTimeout(attempt.run(), YOUTUBE_REQUEST_TIMEOUT_MS, attempt.label);
      if (info) {
        return { info, refreshSuggested: false };
      }
    } catch (error) {
      lastError = error;
      refreshSuggested = refreshSuggested || shouldRefreshYoutubeClient(error);
    }
  }

  if (lastError) {
    throw Object.assign(lastError instanceof Error ? lastError : new Error(String(lastError)), {
      refreshSuggested,
    });
  }

  return { info: null, refreshSuggested };
}

async function resolvePlaybackWithYtDlp(id, { preferVideo = false, quality = "" } = {}) {
  const normalizedQuality = typeof quality === "string" ? quality.trim().toUpperCase() : "";
  const cacheKey = getPlaybackCacheKey(id, { preferVideo, quality: normalizedQuality });
  const cached = getCachedPlaybackSource(cacheKey);
  if (cached) return cached;

  const url = buildYoutubeWatchUrl(id);
  const payload = await runYtDlpJson([
    "-j",
    "--no-playlist",
    "-f",
    preferVideo
      ? buildYtDlpVideoFormatSelector(normalizedQuality)
      : buildYtDlpAudioFormatSelector(normalizedQuality),
    url,
  ]);

  if (preferVideo) {
    const splitResolved = buildSplitDirectPlaybackSource(payload, normalizedQuality);
    if (splitResolved) {
      setCachedPlaybackSource(cacheKey, splitResolved);
      return splitResolved;
    }
  }

  const format = preferVideo
    ? pickRequestedFormat(payload, (entry) => typeof entry?.url === "string" && entry.vcodec !== "none" && entry.acodec !== "none")
    : (
        pickRequestedFormat(payload, (entry) => typeof entry?.url === "string" && entry.acodec !== "none" && entry.vcodec === "none") ||
        pickRequestedFormat(payload, (entry) => typeof entry?.url === "string" && entry.acodec !== "none")
      );
  const resolved = buildDirectPlaybackSourceFromYtDlpFormat(format);

  if (resolved) {
    const availableAudioQualityLabels = buildAvailableAudioQualityLabelsFromFormats(payload?.formats);
    if (availableAudioQualityLabels) {
      resolved.availableAudioQualityLabels = availableAudioQualityLabels;
    }
    setCachedPlaybackSource(cacheKey, resolved);
  }

  return resolved;
}

async function resolveCachedPlayback(id, { preferVideo = false, quality = "" } = {}) {
  const normalizedQuality = typeof quality === "string" ? quality.trim().toUpperCase() : "";
  const cacheKey = getPlaybackCacheKey(id, { preferVideo, quality: normalizedQuality });
  const cached = getCachedPlaybackSource(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = playbackResolutionRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    let yt = await withTimeout(
      getYoutubeMusicClient({ retrievePlayer: true }),
      YOUTUBE_REQUEST_TIMEOUT_MS,
      "YouTube Music playback client init",
    );
    const failureReasons = [];
    const rememberFailure = (label, reason) => {
      const rawReason = reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "";
      const normalizedReason = rawReason.replace(/\s+/g, " ").trim();
      if (!normalizedReason) return;
      failureReasons.push(`${label}: ${normalizedReason}`);
    };

    if (preferVideo && await hasYtDlpBinary()) {
      try {
        const resolved = await resolvePlaybackWithYtDlp(id, {
          preferVideo,
          quality: normalizedQuality,
        });
        if (resolved) {
          setCachedPlaybackSource(cacheKey, resolved);
          return resolved;
        }
        rememberFailure("yt-dlp", "no playable video formats were returned");
      } catch (error) {
        console.warn("yt-dlp video playback fallback failed", id, error);
        rememberFailure("yt-dlp", error);
      }
    }

    try {
      let playbackInfo = await getPlaybackInfo(yt, id);
      if (!playbackInfo.info && playbackInfo.refreshSuggested) {
        yt = await withTimeout(
          getYoutubeMusicClient({ forceRefresh: true, retrievePlayer: true }),
          YOUTUBE_REQUEST_TIMEOUT_MS,
          "YouTube Music playback client refresh",
        );
        playbackInfo = await getPlaybackInfo(yt, id);
      }

      if (playbackInfo.info) {
        const resolved = await resolvePlayback(playbackInfo.info, {
          preferVideo,
          quality: normalizedQuality,
        });
        if (resolved) {
          setCachedPlaybackSource(cacheKey, resolved);
          return resolved;
        }
        rememberFailure(
          preferVideo ? "youtube direct video" : "youtube direct audio",
          "no playable source was returned",
        );
      }
    } catch (error) {
      console.warn(
        preferVideo ? "youtube-music direct video playback failed" : "youtube-music direct audio playback failed",
        id,
        error,
      );
      rememberFailure(preferVideo ? "youtube direct video" : "youtube direct audio", error);
    }

    try {
      const resolved = await resolvePlaybackWithInnertubeStreamingData(yt, id, {
        preferVideo,
        quality: normalizedQuality,
      });
      if (resolved) {
        setCachedPlaybackSource(cacheKey, resolved);
        return resolved;
      }
      rememberFailure(preferVideo ? "youtube js video" : "youtube js audio", "no playable source was returned");
    } catch (error) {
      console.warn(
        preferVideo ? "youtube-music JS video playback fallback failed" : "youtube-music JS audio playback fallback failed",
        id,
        error,
      );
      rememberFailure(preferVideo ? "youtube js video" : "youtube js audio", error);
    }

    if (preferVideo || !(await hasYtDlpBinary())) {
      throw new Error(
        failureReasons.at(-1)
          || `No YouTube Music ${preferVideo ? "video" : "audio"} stream URL available`,
      );
    }

    try {
      const resolved = await resolvePlaybackWithYtDlp(id, {
        preferVideo,
        quality: normalizedQuality,
      });
      if (resolved) {
        setCachedPlaybackSource(cacheKey, resolved);
        return resolved;
      }
      rememberFailure("yt-dlp", "no playable audio formats were returned");
    } catch (error) {
      console.warn(
        preferVideo ? "yt-dlp video playback fallback failed" : "yt-dlp audio playback fallback failed",
        id,
        error,
      );
      rememberFailure("yt-dlp", error);
    }

    throw new Error(
      failureReasons.at(-1)
        || `No YouTube Music ${preferVideo ? "video" : "audio"} stream URL available`,
    );
  })();

  playbackResolutionRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    playbackResolutionRequests.delete(cacheKey);
  }
}

export function buildBrowserPlaybackSource(id, resolved, { preferVideo = false, quality = "" } = {}) {
  if (!resolved) {
    return null;
  }

  const normalizedQuality = typeof quality === "string" ? quality.trim().toUpperCase() : "";
  if (resolved.type !== "direct") {
    return resolved;
  }

  if (preferVideo && resolved.audioUrl) {
    return {
      ...(Array.isArray(resolved.availableAudioQualityLabels) && resolved.availableAudioQualityLabels.length > 0
        ? { availableAudioQualityLabels: resolved.availableAudioQualityLabels }
        : {}),
      ...(resolved.audioQualityLabel ? { audioQualityLabel: resolved.audioQualityLabel } : {}),
      ...(Number.isFinite(Number(resolved?.fallbackVideoHeight)) && Number(resolved.fallbackVideoHeight) > 0
        ? { fallbackVideoHeight: Number(resolved.fallbackVideoHeight) }
        : {}),
      ...(Number.isFinite(Number(resolved?.videoHeight)) && Number(resolved.videoHeight) > 0
        ? { videoHeight: Number(resolved.videoHeight) }
        : {}),
      url: buildVideoPlaybackStreamProxyUrl(id, normalizedQuality),
      audioUrl: buildVideoPlaybackAudioStreamProxyUrl(id, normalizedQuality),
      ...(resolved.fallbackUrl ? { fallbackUrl: buildVideoPlaybackFallbackStreamProxyUrl(id, normalizedQuality) } : {}),
      type: "direct",
    };
  }

  return {
    ...(Array.isArray(resolved.availableAudioQualityLabels) && resolved.availableAudioQualityLabels.length > 0
      ? { availableAudioQualityLabels: resolved.availableAudioQualityLabels }
      : {}),
    ...(resolved.audioQualityLabel ? { audioQualityLabel: resolved.audioQualityLabel } : {}),
    ...(Number.isFinite(Number(resolved?.videoHeight)) && Number(resolved.videoHeight) > 0
      ? { videoHeight: Number(resolved.videoHeight) }
      : {}),
    url: preferVideo
      ? buildVideoPlaybackStreamProxyUrl(id, normalizedQuality)
      : buildPlaybackStreamProxyUrl(id, normalizedQuality),
    type: "direct",
  };
}

async function resolveBrowserPlayback(id, { preferVideo = false, quality = "" } = {}) {
  const normalizedQuality = typeof quality === "string" ? quality.trim().toUpperCase() : "";
  const resolved = await resolveCachedPlayback(id, { preferVideo, quality: normalizedQuality });
  return buildBrowserPlaybackSource(id, resolved, { preferVideo, quality: normalizedQuality });
}

async function fetchPlaybackStreamUpstream(id, { preferVideo = false, quality = "", method = "GET", rangeHeader = "", variant = "primary" } = {}) {
  const resolved = await resolveCachedPlayback(id, { preferVideo, quality });
  const upstreamUrl =
    variant === "audio"
      ? resolved?.audioUrl
      : variant === "fallback"
        ? resolved?.fallbackUrl
        : resolved?.url;

  if (!upstreamUrl) {
    throw new Error(`No YouTube Music ${preferVideo ? "video" : "audio"} stream URL available`);
  }

  const upstreamHeaders = {};
  if (rangeHeader) {
    upstreamHeaders.Range = rangeHeader;
  }

  return await fetch(upstreamUrl, {
    method,
    headers: upstreamHeaders,
  });
}

function buildPlaybackStreamHeaders(upstream, preferVideo = false) {
  const headers = {
    ...DEFAULT_HEADERS,
    "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    "Cache-Control": CACHE_CONTROL,
    "Content-Type": upstream.headers.get("content-type") || (preferVideo ? "video/mp4" : "audio/mp4"),
  };

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers["Content-Length"] = contentLength;
  }

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) {
    headers["Content-Range"] = contentRange;
  }

  return headers;
}

async function createPlaybackStreamResponse(id, { preferVideo = false, quality = "", method = "GET", rangeHeader = "", variant = "primary" } = {}) {
  const upstream = await fetchPlaybackStreamUpstream(id, {
    preferVideo,
    quality,
    method,
    rangeHeader,
    variant,
  });

  const headers = buildPlaybackStreamHeaders(upstream, preferVideo);

  if (method === "HEAD") {
    return {
      statusCode: upstream.status,
      headers,
      body: "",
    };
  }

  const bodyBuffer = Buffer.from(await upstream.arrayBuffer());
  headers["Content-Length"] = String(bodyBuffer.byteLength);

  return {
    statusCode: upstream.status,
    headers,
    body: bodyBuffer.toString("base64"),
    isBase64Encoded: true,
  };
}

async function proxyPlaybackStreamHttpRequest(req, res, { preferVideo = false, variant = "primary" } = {}) {
  const requestUrl = new URL(req.url || "/api/youtube-music", "http://localhost");
  const id = normalizeSourceId(requestUrl.searchParams.get("id"));
  if (!id) {
    const response = buildErrorResponse(400, "Missing track id");
    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers || {})) {
      res.setHeader(key, value);
    }
    res.end(response.body);
    return;
  }

  const quality = String(requestUrl.searchParams.get("quality") || "").trim().toUpperCase();
  const method = req.method || "GET";
  const rangeHeader = String(req.headers?.range || req.headers?.Range || "");

  try {
    const upstream = await fetchPlaybackStreamUpstream(id, {
      preferVideo,
      quality,
      method,
      rangeHeader,
      variant,
    });
    const headers = buildPlaybackStreamHeaders(upstream, preferVideo);

    res.statusCode = upstream.status;
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    if (method === "HEAD" || !upstream.body) {
      res.end();
      return;
    }

    await new Promise((resolve, reject) => {
      const stream = Readable.fromWeb(upstream.body);
      stream.on("error", reject);
      res.on("error", reject);
      res.on("finish", resolve);
      stream.pipe(res);
    });
  } catch (error) {
    console.error("youtube-music-proxy http stream error", error);
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }

    const response = buildErrorResponse(502, error instanceof Error ? error.message : "Failed to stream YouTube Music media");
    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers || {})) {
      res.setHeader(key, value);
    }
    res.end(response.body);
  }
}

function normalizeArtistRef(artist) {
  if (!artist) return null;

  const id =
    normalizeSourceId(artist.channel_id) ||
    normalizeSourceId(artist.id) ||
    normalizeSourceId(artist.browse_id) ||
    normalizeSourceId(artist.endpoint?.payload?.browseId);
  const name = toPlainText(artist.name || artist.title || artist.text);

  if (!name) return null;

  return { id: id || undefined, name };
}

function normalizeTrackResult(item, options = {}) {
  if (!item) return null;

  const sourceId =
    normalizeSourceId(item.id) ||
    normalizeSourceId(item.video_id) ||
    normalizeSourceId(item.videoId) ||
    normalizeSourceId(item.endpoint?.payload?.videoId) ||
    normalizeSourceId(item.current_video_endpoint?.payload?.videoId) ||
    normalizeSourceId(item.basic_info?.id) ||
    normalizeSourceId(item.basic_info?.video_id);
  const title = toPlainText(item.title || item.basic_info?.title || item.name);

  if (!sourceId || !title) return null;

  const artists = (Array.isArray(item.artists) ? item.artists : Array.isArray(item.authors) ? item.authors : [])
    .map(normalizeArtistRef)
    .filter(Boolean);
  const albumId =
    normalizeSourceId(item.album?.id) ||
    normalizeSourceId(item.basic_info?.album?.id);
  const albumName = toPlainText(item.album?.name || item.basic_info?.album || item.basic_info?.album?.name);
  const duration =
    item.duration?.seconds ||
    item.basic_info?.duration_seconds ||
    parseDurationText(item.duration?.text || item.basic_info?.duration || "");
  const thumbnails =
    item.thumbnails ||
    item.thumbnail?.contents ||
    item.basic_info?.thumbnail ||
    item.basic_info?.thumbnails;

  return {
    id: `ytm-${sourceId}`,
    source: "youtube-music",
    sourceId,
    title,
    artist: artists.map((artist) => artist.name).join(", ") || toPlainText(item.author?.name) || "Unknown Artist",
    artistId: artists[0]?.id,
    artists: artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      type: "MAIN",
    })),
    album: albumName || "Unknown Album",
    albumId: albumId || undefined,
    coverUrl: pickBestThumbnail(thumbnails) || "/placeholder.svg",
    duration: Number.isFinite(duration) ? duration : AUDIO_FALLBACK_DURATION_SECONDS,
    explicit: false,
    popularity: 0,
    replayGain: 0,
    peak: 1,
    mixes: null,
    isVideo:
      options.forceVideo === true ||
      item.item_type === "video" ||
      item.basic_info?.is_live_content === true ||
      false,
    canvasColor: "220 70% 55%",
    isUnavailable: false,
  };
}

function normalizeArtistResult(item) {
  if (!item) return null;

  const id =
    normalizeSourceId(item.id) ||
    normalizeSourceId(item.channel_id) ||
    normalizeSourceId(item.author?.channel_id) ||
    normalizeSourceId(item.endpoint?.payload?.browseId);
  const name = toPlainText(item.name || item.title);
  const imageUrl = pickBestThumbnail(item.thumbnails || item.thumbnail?.contents);

  if (!id || !name) return null;

  return {
    id,
    name,
    imageUrl: imageUrl || "/placeholder.svg",
    source: "youtube-music",
  };
}

function normalizeAlbumResult(item) {
  if (!item) return null;

  const id =
    normalizeSourceId(item.id) ||
    normalizeSourceId(item.browse_id) ||
    normalizeSourceId(item.endpoint?.payload?.browseId);
  const title = toPlainText(item.title || item.name);
  const artist = toPlainText(item.author?.name) || (Array.isArray(item.artists) ? item.artists.map((entry) => toPlainText(entry?.name)).filter(Boolean).join(", ") : "");
  const coverUrl = pickBestThumbnail(item.thumbnails || item.thumbnail?.contents);
  const releaseDate = typeof item.year === "string" && item.year.trim() ? item.year.trim() : undefined;

  if (!id || !title) return null;

  return {
    id,
    title,
    artist: artist || "Unknown Artist",
    coverUrl: coverUrl || "/placeholder.svg",
    releaseDate,
    source: "youtube-music",
  };
}

function parseTrackCount(value) {
  if (typeof value !== "string") return 0;
  const match = value.replace(/,/g, "").match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function normalizePlaylistResult(item) {
  if (!item) return null;

  const id =
    normalizeSourceId(item.id) ||
    normalizeSourceId(item.browse_id) ||
    normalizeSourceId(item.endpoint?.payload?.browseId);
  const title = toPlainText(item.title || item.name);
  const description = toPlainText(item.subtitle) || toPlainText(item.author?.name);
  const coverUrl = pickBestThumbnail(item.thumbnails || item.thumbnail?.contents);
  const trackCount = parseTrackCount(item.item_count || item.song_count);

  if (!id || !title) return null;

  return {
    id,
    title,
    description,
    trackCount,
    coverUrl: coverUrl || "/placeholder.svg",
    source: "youtube-music",
  };
}

function normalizeRankedResult(item, options = {}) {
  if (!item) return null;

  if (item.item_type === "song" || options.forceTrack === true) {
    const track = normalizeTrackResult(item, { forceVideo: false });
    return track ? { kind: "track", track } : null;
  }

  if (item.item_type === "video" || options.forceVideo === true) {
    const track = normalizeTrackResult(item, { forceVideo: true });
    return track ? { kind: "video", track } : null;
  }

  if (item.item_type === "artist" || item.item_type === "library_artist") {
    const artist = normalizeArtistResult(item);
    return artist ? { kind: "artist", artist } : null;
  }

  if (item.item_type === "album") {
    const album = normalizeAlbumResult(item);
    return album ? { kind: "album", album } : null;
  }

  if (item.item_type === "playlist") {
    const playlist = normalizePlaylistResult(item);
    return playlist ? { kind: "playlist", playlist } : null;
  }

  return null;
}

function parseCardSubtitleParts(value) {
  return toPlainText(value)
    .split("•")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeTopResultCard(card) {
  if (!card) return null;

  const title = toPlainText(card.title);
  const thumbnailUrl = pickBestThumbnail(card.thumbnail?.contents);
  const subtitleParts = parseCardSubtitleParts(card.subtitle);
  const endpoint = card.on_tap?.payload;
  const videoId = normalizeSourceId(endpoint?.videoId);
  const browseId = normalizeSourceId(endpoint?.browseId);

  if (videoId && title) {
    const mediaType = subtitleParts[0]?.toLowerCase() || "";
    const artist = subtitleParts[1] || "Unknown Artist";
    const durationText = subtitleParts.find((part) => /^\d+:\d{2}(?::\d{2})?$/.test(part)) || "";
    const normalized = normalizeTrackResult({
      id: videoId,
      title,
      author: { name: artist },
      duration: {
        text: durationText,
        seconds: parseDurationText(durationText),
      },
      thumbnails: thumbnailUrl ? [{ url: thumbnailUrl }] : [],
      item_type: mediaType === "video" ? "video" : "song",
    }, { forceVideo: mediaType === "video" });

    if (!normalized) return null;
    return {
      kind: normalized.isVideo ? "video" : "track",
      track: normalized,
    };
  }

  if (browseId && title) {
    if (browseId.startsWith("UC")) {
      const artist = {
        id: browseId,
        name: title,
        imageUrl: thumbnailUrl || "/placeholder.svg",
        source: "youtube-music",
      };
      return { kind: "artist", artist };
    }

    if (browseId.startsWith("MPR")) {
      const album = {
        id: browseId,
        title,
        artist: subtitleParts[1] || subtitleParts[0] || "Unknown Artist",
        coverUrl: thumbnailUrl || "/placeholder.svg",
        releaseDate: undefined,
        source: "youtube-music",
      };
      return { kind: "album", album };
    }

    const playlist = {
      id: browseId,
      title,
      description: toPlainText(card.subtitle),
      trackCount: 0,
      coverUrl: thumbnailUrl || "/placeholder.svg",
      source: "youtube-music",
    };
    return { kind: "playlist", playlist };
  }

  return null;
}

function normalizeLyrics(text) {
  const rawLyrics = toPlainText(text).trim();
  if (!rawLyrics) return null;

  const timestampedLines = rawLyrics
    .split("\n")
    .map((line) => {
      const match = line.match(/\[(\d+):(\d+)(?:\.(\d+))?\]\s*(.+)/);
      if (!match) return null;
      const minutes = Number.parseInt(match[1], 10);
      const seconds = Number.parseInt(match[2], 10);
      const millis = Number.parseInt((match[3] || "0").padEnd(3, "0").slice(0, 3), 10);
      return {
        time: minutes * 60 + seconds + millis / 1000,
        text: match[4].trim(),
      };
    })
    .filter(Boolean);

  return {
    lines: timestampedLines.length > 0
      ? timestampedLines
      : rawLyrics
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, index) => ({
            time: index * 4,
            text: line,
          })),
    provider: "YouTube Music",
    sourceLabel: "YouTube Music",
    sourceHost: "music.youtube.com",
    isSynced: timestampedLines.length > 0,
    isRightToLeft: false,
    rawLyrics,
    rawSubtitles: timestampedLines.length > 0 ? rawLyrics : null,
  };
}

function normalizeLyricsWithSource(text, {
  provider,
  sourceLabel,
  sourceHost,
}) {
  const normalized = normalizeLyrics(text);
  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    provider,
    sourceLabel,
    sourceHost,
  };
}

function normalizeLyricsLookupText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function scoreLyricsSearchCandidate(candidate, expected) {
  const candidateTitle = normalizeLyricsLookupText(typeof candidate.trackName === "string" ? candidate.trackName : "");
  const candidateArtist = normalizeLyricsLookupText(typeof candidate.artistName === "string" ? candidate.artistName : "");
  const candidateAlbum = normalizeLyricsLookupText(typeof candidate.albumName === "string" ? candidate.albumName : "");
  const expectedTitle = normalizeLyricsLookupText(expected.title);
  const expectedArtist = normalizeLyricsLookupText(expected.artist);
  const expectedAlbum = normalizeLyricsLookupText(expected.album);
  const candidateDuration = typeof candidate.duration === "number" && Number.isFinite(candidate.duration)
    ? candidate.duration
    : null;

  let score = 0;

  if (candidateTitle && expectedTitle) {
    if (candidateTitle === expectedTitle) score += 160;
    else if (candidateTitle.includes(expectedTitle) || expectedTitle.includes(candidateTitle)) score += 120;
  }

  if (candidateArtist && expectedArtist) {
    if (candidateArtist === expectedArtist) score += 120;
    else if (candidateArtist.includes(expectedArtist) || expectedArtist.includes(candidateArtist)) score += 80;
  }

  if (candidateAlbum && expectedAlbum) {
    if (candidateAlbum === expectedAlbum) score += 40;
    else if (candidateAlbum.includes(expectedAlbum) || expectedAlbum.includes(candidateAlbum)) score += 20;
  }

  if (expected.duration && candidateDuration) {
    const delta = Math.abs(candidateDuration - expected.duration);
    if (delta <= 2) score += 80;
    else if (delta <= 5) score += 50;
    else if (delta <= 10) score += 25;
    else score -= Math.min(delta, 45);
  }

  if (typeof candidate.syncedLyrics === "string" && candidate.syncedLyrics.trim()) {
    score += 25;
  }

  return score;
}

async function fetchJsonFromUrl(url, label) {
  const response = await withTimeout(fetch(url, {
    headers: {
      Accept: "application/json",
    },
  }), YOUTUBE_REQUEST_TIMEOUT_MS, label);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`${label} request failed: ${response.status}`);
  }

  return await response.json().catch(() => null);
}

async function fetchLrclibLyrics({ title, artist, album, duration }) {
  if (!title || !artist) {
    return null;
  }

  const artistParts = String(artist)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const artistVariations = [
    artistParts[0],
    artistParts.join(" & "),
    artistParts.join(", "),
    String(artist || "").trim(),
  ].filter((value, index, allValues) => value && allValues.indexOf(value) === index);

  const fetchForArtist = async (artistName) => {
    const params = new URLSearchParams({
      track_name: String(title || "").trim(),
      artist_name: artistName,
    });

    if (album) params.set("album_name", String(album).trim());
    if (duration) params.set("duration", String(duration));

    const directPayload = await fetchJsonFromUrl(new URL(`/api/get?${params.toString()}`, LRCLIB_BASE_URL), "LRCLIB lyrics");
    if (directPayload && typeof directPayload.syncedLyrics === "string" && directPayload.syncedLyrics.trim()) {
      return normalizeLyricsWithSource(directPayload.syncedLyrics, {
        provider: "LRCLIB",
        sourceLabel: "LRCLIB",
        sourceHost: "lrclib.net",
      });
    }

    const searchParams = new URLSearchParams({
      track_name: String(title || "").trim(),
      artist_name: artistName,
    });
    const searchPayload = await fetchJsonFromUrl(new URL(`/api/search?${searchParams.toString()}`, LRCLIB_BASE_URL), "LRCLIB search");
    if (!Array.isArray(searchPayload) || searchPayload.length === 0) {
      throw new Error("No synced LRCLIB lyrics found for this artist variation");
    }

    const bestMatch = [...searchPayload]
      .sort((left, right) => (
        scoreLyricsSearchCandidate(right, {
          artist: artistName,
          title,
          album: String(album || "").trim(),
          duration: typeof duration === "number" && Number.isFinite(duration) ? duration : null,
        }) - scoreLyricsSearchCandidate(left, {
          artist: artistName,
          title,
          album: String(album || "").trim(),
          duration: typeof duration === "number" && Number.isFinite(duration) ? duration : null,
        })
      ))[0];

    if (bestMatch && typeof bestMatch.syncedLyrics === "string" && bestMatch.syncedLyrics.trim()) {
      return normalizeLyricsWithSource(bestMatch.syncedLyrics, {
        provider: "LRCLIB",
        sourceLabel: "LRCLIB",
        sourceHost: "lrclib.net",
      });
    }

    throw new Error("No synced LRCLIB lyrics found for this artist variation");
  };

  try {
    return await Promise.any(artistVariations.map(fetchForArtist));
  } catch {
    return null;
  }
}

async function fetchFallbackYoutubeLyrics(id) {
  const endpoint = new URL("/v2/youtube/lyrics", YOUTUBE_LYRICS_FALLBACK_BASE_URL);
  endpoint.searchParams.set("trackId", id);

  const response = await withTimeout(fetch(endpoint, {
    headers: {
      Accept: "application/json",
    },
  }), YOUTUBE_REQUEST_TIMEOUT_MS, "LewdHuTao YouTube lyrics");

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`LewdHuTao YouTube lyrics request failed: ${response.status}`);
  }

  const payload = await response.json().catch(() => null);
  const data = payload && typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object"
    ? payload.data
    : payload;
  const lyricsText = data && typeof data === "object" && typeof data.lyrics === "string"
    ? data.lyrics
    : "";

  return normalizeLyricsWithSource(lyricsText, {
    provider: "LewdHuTao Lyrics API",
    sourceLabel: "LewdHuTao Lyrics API",
    sourceHost: endpoint.host,
  });
}

function getSearchResults(search, shelfName = null) {
  if (Array.isArray(search?.results)) {
    return search.results;
  }

  const namedShelf = shelfName ? search?.[shelfName] : null;
  if (Array.isArray(namedShelf?.contents)) {
    return namedShelf.contents;
  }

  if (Array.isArray(search?.contents)) {
    const shelvesWithContents = search.contents.filter((section) => Array.isArray(section?.contents));
    if (shelvesWithContents.length === 0) {
      return [];
    }

    if (shelfName) {
      const matchingShelf = shelvesWithContents.find((section) => {
        const title = toPlainText(section?.title);
        return matchesSearchCategoryLabel(title, shelfName);
      });
      if (matchingShelf) {
        return matchingShelf.contents;
      }
    }

    return shelvesWithContents.flatMap((section) => section.contents);
  }

  return [];
}

function getTopCard(search) {
  if (!Array.isArray(search?.contents)) return null;
  return search.contents.find((section) => section?.constructor?.type === "MusicCardShelf") || null;
}

const SEARCH_FILTER_ALIASES = {
  songs: ["song", "songs", "track", "tracks"],
  videos: ["video", "videos", "music video", "music videos"],
  "community playlists": ["community playlist", "community playlists", "playlist", "playlists"],
};

function normalizeSearchCategoryLabel(value) {
  return toPlainText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesSearchCategoryLabel(label, category) {
  const normalizedLabel = normalizeSearchCategoryLabel(label);
  if (!normalizedLabel) {
    return false;
  }

  const normalizedCategory = normalizeSearchCategoryLabel(category);
  const aliases = SEARCH_FILTER_ALIASES[normalizedCategory] || [normalizedCategory, normalizedCategory.replace(/s$/, "")];
  return aliases.some((alias) => {
    const normalizedAlias = normalizeSearchCategoryLabel(alias);
    return normalizedLabel === normalizedAlias || normalizedLabel.includes(normalizedAlias);
  });
}

function getSearchFilterLabel(filter) {
  if (typeof filter === "string") {
    return filter.trim();
  }

  return toPlainText(
    filter?.title ||
    filter?.text ||
    filter?.label ||
    filter?.name ||
    filter?.tooltip ||
    filter?.chip_text ||
    filter?.chipCloudChipRenderer?.text,
  );
}

async function applySearchFilter(search, filterName) {
  if (!search || !Array.isArray(search.filters)) {
    return null;
  }

  const matchedFilterLabel = search.filters
    .map((filter) => getSearchFilterLabel(filter))
    .find((label) => matchesSearchCategoryLabel(label, filterName));
  if (!matchedFilterLabel) {
    return null;
  }

  try {
    return await search.applyFilter(matchedFilterLabel);
  } catch {
    return null;
  }
}

function takeRankedResults(items, limit) {
  return items
    .map((item) => normalizeRankedResult(item))
    .filter(Boolean)
    .slice(0, limit);
}

async function resolvePlayback(info, { preferVideo = false, quality = "" } = {}) {
  const player = info?.actions?.session?.player || info?.session?.player;
  const streamingData = info?.streaming_data;
  const normalizedQuality = typeof quality === "string" ? quality.trim().toUpperCase() : "";
  const normalizedVideoQuality = normalizeVideoQuality(normalizedQuality);

  if (!streamingData) return null;

  if (!preferVideo) {
    const audioAttempts = [
      {
        type: "audio",
        quality: normalizedQuality === "LOW" || normalizedQuality === "MEDIUM" ? "bestefficiency" : "best",
        format: "mp4",
      },
      {
        type: "audio",
        quality: normalizedQuality === "LOW" || normalizedQuality === "MEDIUM" ? "bestefficiency" : "best",
        format: "any",
      },
    ];

    for (const attempt of audioAttempts) {
      try {
        const format = info.chooseFormat(attempt);
        const url = await format.decipher(player);
        if (url) {
          return {
            ...(buildAudioQualityLabelFromFormat(format)
              ? { audioQualityLabel: buildAudioQualityLabelFromFormat(format) }
              : {}),
            url,
            type: "direct",
          };
        }
      } catch {
        // Continue to the next audio candidate before manifest fallback.
      }
    }

    if (typeof streamingData.hls_manifest_url === "string" && streamingData.hls_manifest_url) {
      return { url: streamingData.hls_manifest_url, type: "hls" };
    }
  }

  if (preferVideo) {
    const hlsManifestUrl =
      typeof streamingData.hls_manifest_url === "string" && streamingData.hls_manifest_url
        ? streamingData.hls_manifest_url
        : "";
    const dashManifestUrl =
      typeof streamingData.dash_manifest_url === "string" && streamingData.dash_manifest_url
        ? streamingData.dash_manifest_url
        : "";

    if (shouldPreferHlsForVideo(normalizedVideoQuality)) {
      if (hlsManifestUrl) {
        return { url: hlsManifestUrl, type: "hls" };
      }
      if (dashManifestUrl) {
        return { url: dashManifestUrl, type: "dash" };
      }
    } else {
      if (dashManifestUrl) {
        return { url: dashManifestUrl, type: "dash" };
      }
      if (hlsManifestUrl) {
        return { url: hlsManifestUrl, type: "hls" };
      }
    }
  }

  try {
    const format = info.chooseFormat({
      format: "mp4",
      quality: "best",
    });
    const url = await format.decipher(player);
    if (url) {
      return {
        url,
        type: "direct",
      };
    }
  } catch {
    // Continue to manifest fallback.
  }

  if (typeof streamingData.dash_manifest_url === "string" && streamingData.dash_manifest_url) {
    return { url: streamingData.dash_manifest_url, type: "dash" };
  }

  if (typeof streamingData.hls_manifest_url === "string" && streamingData.hls_manifest_url) {
    return { url: streamingData.hls_manifest_url, type: "hls" };
  }

  return null;
}

async function handleAction(action, params) {
  switch (action) {
    case "search": {
      const query = String(params.q || "").trim();
      if (!query) {
        throw new Error("Missing search query");
      }

      const yt = await withTimeout(
        getYoutubeMusicClient(),
        YOUTUBE_REQUEST_TIMEOUT_MS,
        "YouTube Music client init",
      );
      const baseSearch = await withTimeout(yt.music.search(query), YOUTUBE_REQUEST_TIMEOUT_MS, "YouTube Music search");
      const [songSearch, videoSearch, playlistSearch] = await Promise.all([
        applySearchFilter(baseSearch, "Songs"),
        applySearchFilter(baseSearch, "Videos"),
        applySearchFilter(baseSearch, "Community playlists"),
      ]);

      const normalizedTopResult = normalizeTopResultCard(getTopCard(baseSearch));
      const topResult = normalizedTopResult?.kind === "video" ? null : normalizedTopResult;
      const rankedResults = takeRankedResults(getSearchResults(baseSearch), 24)
        .filter((item) => item.kind !== "video");
      const tracks = getSearchResults(songSearch || baseSearch, "songs")
        .map((item) => normalizeTrackResult(item))
        .filter((item) => item && item.isVideo !== true);
      const videos = getSearchResults(videoSearch || baseSearch, "videos")
        .filter((item) => item?.item_type === "video")
        .map((item) => normalizeTrackResult(item, { forceVideo: true }))
        .filter(Boolean);
      const playlists = getSearchResults(playlistSearch || baseSearch, "community playlists")
        .map((item) => normalizePlaylistResult(item))
        .filter(Boolean);

      const rankedArtists = [];
      const rankedAlbums = [];
      for (const item of rankedResults) {
        if (item.kind === "artist" && rankedArtists.length < 8) rankedArtists.push(item.artist);
        if (item.kind === "album" && rankedAlbums.length < 8) rankedAlbums.push(item.album);
      }

      return {
        topResult,
        rankedResults,
        tracks: tracks.slice(0, 20),
        videos: videos.slice(0, 20),
        artists: rankedArtists,
        albums: rankedAlbums,
        playlists: playlists.slice(0, 10),
      };
    }
    case "lyrics": {
      const id = normalizeSourceId(params.id);
      if (!id) {
        throw new Error("Missing track id");
      }

      const yt = await withTimeout(
        getYoutubeMusicClient(),
        YOUTUBE_REQUEST_TIMEOUT_MS,
        "YouTube Music client init",
      );

      const fallbackLookup = {
        title: typeof params.title === "string" ? params.title.trim() : "",
        artist: typeof params.artist === "string" ? params.artist.trim() : "",
        album: typeof params.album === "string" ? params.album.trim() : "",
        duration: (() => {
          const parsed = Number(params.duration);
          return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
        })(),
      };

      let nativeLyricsError = null;
      let nativeUnsyncedLyrics = null;

      try {
        const lyrics = await withTimeout(yt.music.getLyrics(id), YOUTUBE_REQUEST_TIMEOUT_MS, "YouTube Music lyrics");
        const normalizedNativeLyrics = normalizeLyrics(lyrics?.description);
        if (normalizedNativeLyrics) {
          if (normalizedNativeLyrics.isSynced) {
            return normalizedNativeLyrics;
          }
          nativeUnsyncedLyrics = normalizedNativeLyrics;
        }
      } catch (error) {
        nativeLyricsError = error;
      }

      try {
        const lrclibLyrics = await fetchLrclibLyrics(fallbackLookup);
        if (lrclibLyrics) {
          return lrclibLyrics;
        }
      } catch (error) {
        console.warn("youtube-music-proxy LRCLIB lyrics fallback failed", error);
      }

      try {
        const fallbackLyrics = await fetchFallbackYoutubeLyrics(id);
        if (fallbackLyrics) {
          return fallbackLyrics;
        }
      } catch (error) {
        console.warn("youtube-music-proxy lyrics fallback failed", error);
      }

      if (nativeUnsyncedLyrics) {
        return nativeUnsyncedLyrics;
      }

      if (nativeLyricsError) {
        throw nativeLyricsError;
      }

      return null;
    }
    case "playback": {
      const id = normalizeSourceId(params.id);
      if (!id) {
        throw new Error("Missing track id");
      }

      const quality = String(params.quality || "").trim().toUpperCase();
      return await resolveBrowserPlayback(id, { preferVideo: false, quality });
    }
    case "video-playback": {
      const id = normalizeSourceId(params.id);
      if (!id) {
        throw new Error("Missing track id");
      }
      const quality = String(params.quality || "").trim().toUpperCase();
      return await resolveBrowserPlayback(id, { preferVideo: true, quality });
    }
    default:
      throw new Error("Unsupported YouTube Music action");
  }
}

function buildErrorResponse(statusCode, message) {
  return {
    statusCode,
    headers: {
      ...DEFAULT_HEADERS,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ error: message }),
  };
}

export async function handleYoutubeMusicProxyEvent(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: "ok",
    };
  }

  const params = event.queryStringParameters || {};
  const action = String(params.action || "").trim();

  if (!VALID_ACTIONS.has(action)) {
    return buildErrorResponse(400, "Invalid YouTube Music action");
  }

  if (action === "stream" || action === "video-stream" || action === "video-audio-stream" || action === "video-fallback-stream") {
    if (event.httpMethod !== "GET" && event.httpMethod !== "HEAD") {
      return buildErrorResponse(405, "Method not allowed");
    }

    const id = normalizeSourceId(params.id);
    if (!id) {
      return buildErrorResponse(400, "Missing track id");
    }

    const quality = String(params.quality || "").trim().toUpperCase();

    try {
      return await createPlaybackStreamResponse(id, {
        preferVideo: action === "video-stream" || action === "video-audio-stream" || action === "video-fallback-stream",
        quality,
        method: event.httpMethod,
        rangeHeader: String(event.headers?.range || event.headers?.Range || ""),
        variant:
          action === "video-audio-stream"
            ? "audio"
            : action === "video-fallback-stream"
              ? "fallback"
              : "primary",
      });
    } catch (error) {
      console.error("youtube-music-proxy stream error", error);
      return buildErrorResponse(502, error instanceof Error ? error.message : "Failed to stream YouTube Music audio");
    }
  }

  if (event.httpMethod !== "GET") {
    return buildErrorResponse(405, "Method not allowed");
  }

  try {
    const data = await handleAction(action, params);
    return {
      statusCode: 200,
      headers: {
        ...DEFAULT_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": CACHE_CONTROL,
      },
      body: JSON.stringify({ data }),
    };
  } catch (error) {
    console.error("youtube-music-proxy error", action, error);
    return buildErrorResponse(502, error instanceof Error ? error.message : "Failed to load YouTube Music data");
  }
}

export async function proxyYoutubeMusicHttpRequest(req, res) {
  const requestUrl = new URL(req.url || "/api/youtube-music", "http://localhost");
  const action = String(requestUrl.searchParams.get("action") || "").trim();

  if (action === "stream" || action === "video-stream" || action === "video-audio-stream" || action === "video-fallback-stream") {
    await proxyPlaybackStreamHttpRequest(req, res, {
      preferVideo: action === "video-stream" || action === "video-audio-stream" || action === "video-fallback-stream",
      variant:
        action === "video-audio-stream"
          ? "audio"
          : action === "video-fallback-stream"
            ? "fallback"
            : "primary",
    });
    return;
  }

  const response = await handleYoutubeMusicProxyEvent({
    httpMethod: req.method || "GET",
    headers: req.headers,
    queryStringParameters: Object.fromEntries(requestUrl.searchParams.entries()),
  });

  res.statusCode = response.statusCode;
  for (const [key, value] of Object.entries(response.headers || {})) {
    res.setHeader(key, value);
  }
  if (response.isBase64Encoded) {
    res.end(Buffer.from(response.body || "", "base64"));
    return;
  }
  res.end(response.body);
}
