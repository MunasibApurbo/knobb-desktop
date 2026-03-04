import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const API_INSTANCES = [
  "https://us-west.monochrome.tf",
  "https://eu-central.monochrome.tf",
  "https://api.monochrome.tf",
  "https://arran.monochrome.tf",
  "https://triton.squid.wtf",
  "https://monochrome-api.samidy.com",
  "https://wolf.qqdl.site",
  "https://maus.qqdl.site",
  "https://vogel.qqdl.site",
  "https://katze.qqdl.site",
  "https://hund.qqdl.site",
  "https://tidal.kinoplus.online",
];

const STREAMING_INSTANCES = [
  "https://api.monochrome.tf",
  "https://arran.monochrome.tf",
  "https://triton.squid.wtf",
  "https://wolf.qqdl.site",
  "https://maus.qqdl.site",
  "https://vogel.qqdl.site",
  "https://katze.qqdl.site",
  "https://hund.qqdl.site",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    .filter((item): item is string => !!item);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : [...fallback];
}

async function fetchWithTimeout(target: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(target, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");

    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Missing endpoint param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedPool = url.searchParams.get("pool");
    const defaultPool = requestedPool === "streaming" || endpoint === "track"
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

    const errors: string[] = [];

    for (const instance of attemptOrder) {
      const targetUrl = new URL(`${instance}/${endpoint}`);
      url.searchParams.forEach((value, key) => {
        if (key !== "endpoint" && key !== "pool" && key !== "instance" && key !== "instances") {
          targetUrl.searchParams.set(key, value);
        }
      });

      console.log(`Proxying to: ${targetUrl.toString()}`);

      try {
        const response = await fetchWithTimeout(targetUrl.toString());
        const bodyText = await response.text();

        if (!response.ok) {
          errors.push(`${instance}: HTTP ${response.status}`);
          continue;
        }

        let data: any;
        try {
          data = JSON.parse(bodyText);
        } catch {
          errors.push(`${instance}: invalid JSON response`);
          continue;
        }

        // For /track endpoint, decode the manifest to extract stream URL
        if (endpoint === "track" && data?.data?.manifest) {
          try {
            const manifestMime = data.data.manifestMimeType;
            const decoded = atob(data.data.manifest);

            if (manifestMime === "application/vnd.tidal.bts") {
              // JSON manifest with direct URL
              const manifestJson = JSON.parse(decoded);
              data.data.decodedManifest = manifestJson;
            } else if (manifestMime === "application/dash+xml") {
              // DASH manifest - extract the initialization URL
              data.data.decodedManifest = { type: "dash", xml: decoded };
            }
          } catch (e) {
            console.error("Failed to decode manifest:", e);
          }
        }

        data._instance = instance;
        return new Response(JSON.stringify(data), {
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
      }
    );
  }
});
