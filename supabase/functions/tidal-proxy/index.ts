import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MONOCHROME_API = "https://api.monochrome.tf";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Build target URL
    const targetUrl = new URL(`${MONOCHROME_API}/${endpoint}`);
    url.searchParams.forEach((value, key) => {
      if (key !== "endpoint") {
        targetUrl.searchParams.set(key, value);
      }
    });

    console.log(`Proxying to: ${targetUrl.toString()}`);

    const response = await fetch(targetUrl.toString());
    const data = await response.json();

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

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
