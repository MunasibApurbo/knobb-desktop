import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const PRIMARY_APP_ORIGIN = "https://knobb.netlify.app";
const DEFAULT_ALLOWED_ORIGINS = [
  PRIMARY_APP_ORIGIN,
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

type AuthenticatedUser = {
  id: string;
  email?: string;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
};

function getProviders(user: AuthenticatedUser) {
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.filter((provider): provider is string => typeof provider === "string")
    : [];

  if (providers.length > 0) {
    return providers.map((provider) => provider.trim().toLowerCase()).filter(Boolean);
  }

  const fallbackProvider = user.app_metadata?.provider;
  return typeof fallbackProvider === "string" && fallbackProvider.trim()
    ? [fallbackProvider.trim().toLowerCase()]
    : [];
}

function requiresPasswordReauth(user: AuthenticatedUser) {
  const providers = getProviders(user);
  return providers.length === 0 || providers.includes("email");
}

async function getAuthenticatedUser(token: string): Promise<AuthenticatedUser | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });

  if (!response.ok) return null;
  const user = await response.json();
  if (!user?.id) return null;
  return user as AuthenticatedUser;
}

function normalizeOrigin(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins() {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured?.trim()) {
    return new Set(DEFAULT_ALLOWED_ORIGINS);
  }

  const origins = configured
    .split(",")
    .map((entry) => normalizeOrigin(entry.trim()))
    .filter((entry): entry is string => Boolean(entry));

  return new Set(origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS);
}

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? PRIMARY_APP_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
}

serve(async (req) => {
  const origin = normalizeOrigin(req.headers.get("origin"));
  const allowedOrigins = getAllowedOrigins();
  const isOriginAllowed = !origin || allowedOrigins.has(origin);
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    if (!isOriginAllowed) {
      return new Response("Origin not allowed", { status: 403, headers: corsHeaders });
    }
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }

  if (!isOriginAllowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await getAuthenticatedUser(token);
    if (!user?.id || !user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";
    const needsPassword = requiresPasswordReauth(user);
    if (!needsPassword) {
      return new Response(JSON.stringify({
        error: "Fresh reauthentication for this sign-in method is not supported yet. Contact support to delete this account securely.",
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (needsPassword && (!password || password.length < 6)) {
      return new Response(JSON.stringify({ error: "Password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (needsPassword) {
      // Password-based accounts must prove password possession before deletion.
      const userClient = createClient(supabaseUrl, anonKey);
      const { error: passwordError } = await userClient.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (passwordError) {
        return new Response(JSON.stringify({ error: "Invalid password" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("delete-account error", error);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
