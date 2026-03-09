import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const API_INSTANCES = [
  "https://tidal-api.binimum.org",
  "https://tidal.kinoplus.online",
  "https://triton.squid.wtf",
  "https://wolf.qqdl.site",
  "https://maus.qqdl.site",
  "https://vogel.qqdl.site",
  "https://katze.qqdl.site",
  "https://hund.qqdl.site",
];

const STREAMING_INSTANCES = [
  "https://tidal-api.binimum.org",
  "https://tidal.kinoplus.online",
  "https://triton.squid.wtf",
  "https://wolf.qqdl.site",
  "https://maus.qqdl.site",
  "https://vogel.qqdl.site",
  "https://katze.qqdl.site",
  "https://hund.qqdl.site",
];

const ALLOWED_ENDPOINTS = new Set([
  "",
  "/",
  "search",
  "artist",
  "artist/top",
  "artist/bio",
  "artist/similar",
  "album",
  "album/tracks",
  "album/similar",
  "playlist",
  "mix",
  "track",
  "info",
  "recommendations",
  "lyrics",
  "cover",
  "topvideos",
  "video",
]);

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:4173",
];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;
const rateLimitStore = new Map<string, { windowStart: number; count: number }>();

function getAllowedOrigins(): Set<string> {
  const fromEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (!fromEnv?.trim()) return new Set(DEFAULT_ALLOWED_ORIGINS);
  const parsed = fromEnv
    .split(",")
    .map((value) => normalizeInstance(value))
    .filter((value): value is string => !!value);
  return new Set(parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS);
}

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    Vary: "Origin",
  };
}

function isLoopbackOrigin(origin: string | null) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function normalizeInstance(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return null;
  }
}

function parseInstances(raw: string | null, fallback: string[]): string[] {
  if (!raw) return [...fallback];
  const parsed = raw
    .split(",")
    .map((item) => normalizeInstance(item))
    .filter((item): item is string => !!item && fallback.includes(item));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : [...fallback];
}

async function fetchWithTimeout(target: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(target, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return false;
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return existing.count > RATE_LIMIT_MAX_REQUESTS;
}

function mapEndpoint(endpoint: string, incoming: URLSearchParams) {
  const mappedParams = new URLSearchParams(incoming);
  let path = endpoint;

  if (endpoint === "root") {
    path = "";
  } else if (endpoint === "artist/top") {
    path = "artist";
    const id = mappedParams.get("id");
    if (id && !mappedParams.get("f")) mappedParams.set("f", id);
    mappedParams.delete("id");
  } else if (endpoint === "artist/bio") {
    path = "artist";
    const id = mappedParams.get("id");
    if (!id && mappedParams.get("f")) {
      mappedParams.set("id", mappedParams.get("f") || "");
    }
    mappedParams.delete("f");
  } else if (endpoint === "album/tracks") {
    path = "album";
  }

  return { path, params: mappedParams };
}

type ProxyPayload = {
  version?: string;
  tracks?: unknown;
  artist?: {
    bio?: string;
    description?: string;
  };
  data?: {
    items?: unknown;
    text?: string;
    manifest?: string;
    manifestMimeType?: string;
    decodedManifest?: unknown;
  };
  _instance?: string;
} & Record<string, unknown>;

function normalizeResponseForEndpoint(endpoint: string, payload: ProxyPayload) {
  if (endpoint === "artist/top") {
    const tracks = payload?.tracks || payload?.data?.items || [];
    return {
      version: payload?.version || "2.x",
      data: { items: Array.isArray(tracks) ? tracks : [] },
    };
  }

  if (endpoint === "artist/bio") {
    const text =
      payload?.artist?.bio
      || payload?.artist?.description
      || payload?.data?.text
      || "";
    return {
      version: payload?.version || "2.x",
      data: { text },
    };
  }

  if (endpoint === "album/tracks") {
    const tracks = payload?.data?.items || payload?.items || [];
    return {
      version: payload?.version || "2.x",
      data: { items: Array.isArray(tracks) ? tracks : [] },
    };
  }

  return payload;
}

serve(async (req) => {
  const origin = normalizeInstance(req.headers.get("origin"));
  const allowedOrigins = getAllowedOrigins();
  const isOriginAllowed = !origin || allowedOrigins.has(origin) || isLoopbackOrigin(origin);
  const corsHeaders = buildCorsHeaders(isOriginAllowed ? origin : null);

  if (req.method === "OPTIONS") {
    if (!isOriginAllowed) {
      return new Response("Origin not allowed", { status: 403, headers: corsHeaders });
    }
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!isOriginAllowed) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") || "";
    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitKey = `${getClientIp(req)}:${endpoint}`;
    if (isRateLimited(rateLimitKey)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedPool = url.searchParams.get("pool");
    const defaultPool = requestedPool === "streaming" || endpoint === "track" || endpoint === "video"
      ? STREAMING_INSTANCES
      : API_INSTANCES;

    const preferredInstance = normalizeInstance(url.searchParams.get("instance"));
    const providedInstances = parseInstances(url.searchParams.get("instances"), defaultPool);
    const attemptOrder = Array.from(
      new Set([
        ...(preferredInstance ? [preferredInstance] : []),
        ...providedInstances,
      ]),
    );

    const params = new URLSearchParams(url.searchParams);
    ["endpoint", "pool", "instance", "instances"].forEach((key) => params.delete(key));
    const mapped = mapEndpoint(endpoint, params);
    const errors: string[] = [];

    for (const instance of attemptOrder) {
      const targetUrl = new URL(`${instance}/${mapped.path}`);
      mapped.params.forEach((value, key) => {
        if (value !== "") {
          targetUrl.searchParams.set(key, value);
        }
      });

      try {
        const response = await fetchWithTimeout(targetUrl.toString());
        const bodyText = await response.text();

        if (!response.ok) {
          errors.push(`${instance}: HTTP ${response.status}`);
          continue;
        }

        let data: ProxyPayload;
        try {
          data = JSON.parse(bodyText) as ProxyPayload;
        } catch {
          errors.push(`${instance}: invalid JSON response`);
          continue;
        }

        if (mapped.path === "track" && data?.data?.manifest) {
          try {
            const manifestMime = data.data.manifestMimeType;
            const decoded = atob(data.data.manifest);

            if (manifestMime === "application/vnd.tidal.bts") {
              const manifestJson = JSON.parse(decoded);
              data.data.decodedManifest = manifestJson;
            } else if (manifestMime === "application/dash+xml") {
              data.data.decodedManifest = { type: "dash", xml: decoded };
            }
          } catch (error) {
            console.error("Failed to decode track manifest:", error);
          }
        }

        const normalized = normalizeResponseForEndpoint(endpoint, data);
        normalized._instance = instance;

        return new Response(JSON.stringify(normalized), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown fetch error";
        errors.push(`${instance}: ${message}`);
      }
    }

    return new Response(
      JSON.stringify({ error: "All API instances failed", details: errors }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
