import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const PAGE_SIZE = 25;
const RECENT_LIMIT = 50;
const ADMIN_ROLES = new Set(["admin", "owner"]);

type AuthenticatedUser = {
  id: string;
  email?: string;
  app_metadata?: {
    role?: string;
    app_role?: string;
    roles?: string[];
  };
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
  profile_visibility: "private" | "shared" | null;
  live_status_visibility: "private" | "shared" | null;
};

type AuthRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function hasAdminRole(user: AuthenticatedUser | null) {
  if (!user?.app_metadata) return false;

  const directRoles = [user.app_metadata.role, user.app_metadata.app_role]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());

  if (directRoles.some((role) => ADMIN_ROLES.has(role))) {
    return true;
  }

  if (Array.isArray(user.app_metadata.roles)) {
    return user.app_metadata.roles.some((role) => ADMIN_ROLES.has(role.trim().toLowerCase()));
  }

  return false;
}

async function getAuthenticatedUser(token: string) {
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
  return await response.json() as AuthenticatedUser;
}

function normalizeVisibility(value: string | null | undefined) {
  return value === "shared" ? "shared" : "private";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mergeUsers(profileRows: ProfileRow[], authRows: AuthRow[]) {
  const merged = new Map<string, {
    user_id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
    profile_visibility: "private" | "shared";
    live_status_visibility: "private" | "shared";
  }>();

  for (const row of authRows) {
    merged.set(row.id, {
      user_id: row.id,
      email: row.email,
      display_name: null,
      avatar_url: null,
      created_at: row.created_at,
      last_sign_in_at: row.last_sign_in_at,
      profile_visibility: "private",
      live_status_visibility: "private",
    });
  }

  for (const row of profileRows) {
    const existing = merged.get(row.user_id);
    merged.set(row.user_id, {
      user_id: row.user_id,
      email: existing?.email ?? null,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      created_at: existing?.created_at ?? row.created_at,
      last_sign_in_at: existing?.last_sign_in_at ?? null,
      profile_visibility: normalizeVisibility(row.profile_visibility),
      live_status_visibility: normalizeVisibility(row.live_status_visibility),
    });
  }

  return Array.from(merged.values()).sort((left, right) => {
    const leftDate = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightDate = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightDate - leftDate;
  });
}

async function getSummary(serviceClient: ReturnType<typeof createClient>) {
  const [usersCount, sharedProfilesCount, sharedLiveCount, publicPlaylistsCount] = await Promise.all([
    serviceClient.schema("auth").from("users").select("id", { count: "exact", head: true }),
    serviceClient.from("profiles").select("user_id", { count: "exact", head: true }).eq("profile_visibility", "shared"),
    serviceClient.from("profiles").select("user_id", { count: "exact", head: true }).eq("live_status_visibility", "shared"),
    serviceClient.from("playlists").select("id", { count: "exact", head: true }).eq("visibility", "public"),
  ]);

  return {
    totalUsers: usersCount.count ?? 0,
    sharedProfiles: sharedProfilesCount.count ?? 0,
    sharedLiveStatuses: sharedLiveCount.count ?? 0,
    publicPlaylists: publicPlaylistsCount.count ?? 0,
  };
}

async function fetchAuthRows(
  serviceClient: ReturnType<typeof createClient>,
  userIds: string[],
) {
  if (userIds.length === 0) return [] as AuthRow[];

  const { data, error } = await serviceClient
    .schema("auth")
    .from("users")
    .select("id,email,created_at,last_sign_in_at")
    .in("id", userIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AuthRow[];
}

async function runUserSearch(
  serviceClient: ReturnType<typeof createClient>,
  query: string,
  page: number,
) {
  const trimmedQuery = query.trim();
  const offset = Math.max(0, (page - 1) * PAGE_SIZE);

  if (!trimmedQuery) {
    const { data, error } = await serviceClient
      .schema("auth")
      .from("users")
      .select("id,email,created_at,last_sign_in_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE);

    if (error) {
      throw new Error(error.message);
    }

    const authRows = (data ?? []) as AuthRow[];
    const authUserIds = authRows.map((row) => row.id);
    const { data: profilesData, error: profilesError } = authUserIds.length === 0
      ? { data: [] as ProfileRow[], error: null }
      : await serviceClient
        .from("profiles")
        .select("user_id,display_name,avatar_url,created_at,profile_visibility,live_status_visibility")
        .in("user_id", authUserIds);

    if (profilesError) {
      throw new Error(profilesError.message);
    }

    const profiles = (profilesData ?? []) as ProfileRow[];
    return {
      users: mergeUsers(profiles, authRows).slice(0, PAGE_SIZE),
      hasMore: authRows.length > PAGE_SIZE,
    };
  }

  const profileQuery = serviceClient
    .from("profiles")
    .select("user_id,display_name,avatar_url,created_at,profile_visibility,live_status_visibility");

  if (isUuid(trimmedQuery)) {
    profileQuery.or(`display_name.ilike.%${trimmedQuery}%,user_id.eq.${trimmedQuery}`).limit(100);
  } else {
    profileQuery.ilike("display_name", `%${trimmedQuery}%`).limit(100);
  }

  const authQuery = serviceClient
    .schema("auth")
    .from("users")
    .select("id,email,created_at,last_sign_in_at");

  if (isUuid(trimmedQuery)) {
    authQuery.or(`email.ilike.%${trimmedQuery}%,id.eq.${trimmedQuery}`).limit(100);
  } else {
    authQuery.ilike("email", `%${trimmedQuery}%`).limit(100);
  }

  const [profileResponse, authResponse] = await Promise.all([profileQuery, authQuery]);

  if (profileResponse.error) {
    throw new Error(profileResponse.error.message);
  }

  if (authResponse.error) {
    throw new Error(authResponse.error.message);
  }

  const profiles = (profileResponse.data ?? []) as ProfileRow[];
  const authRows = (authResponse.data ?? []) as AuthRow[];
  const allUserIds = Array.from(new Set([
    ...profiles.map((row) => row.user_id),
    ...authRows.map((row) => row.id),
  ]));

  const missingProfileIds = allUserIds.filter((userId) => !profiles.some((row) => row.user_id === userId));
  const extraProfilesResponse = missingProfileIds.length === 0
    ? { data: [] as ProfileRow[], error: null }
    : ((await serviceClient
      .from("profiles")
      .select("user_id,display_name,avatar_url,created_at,profile_visibility,live_status_visibility")
      .in("user_id", missingProfileIds)) as { data: ProfileRow[] | null; error: { message: string } | null });

  if (extraProfilesResponse.error) {
    throw new Error(extraProfilesResponse.error.message);
  }

  const merged = mergeUsers([...profiles, ...(extraProfilesResponse.data ?? [])], authRows);
  const paged = merged.slice(offset, offset + PAGE_SIZE + 1);

  return {
    users: paged.slice(0, PAGE_SIZE),
    hasMore: paged.length > PAGE_SIZE,
  };
}

async function getUserAuditPayload(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
) {
  const [profileResponse, authResponse, currentStatusResponse, playlistsCount, playHistoryCount, likedSongsCount, savedAlbumsCount, favoriteArtistsCount, notificationsCount, playlistsRecent, playHistoryRecent, likedSongsRecent, savedAlbumsRecent, favoriteArtistsRecent, notificationsRecent] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("user_id,display_name,avatar_url,created_at,profile_visibility,live_status_visibility")
      .eq("user_id", userId)
      .maybeSingle(),
    serviceClient.auth.admin.getUserById(userId),
    serviceClient
      .from("current_status")
      .select("track_title,artist_name,cover_url,track_id,started_at,updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    serviceClient.from("playlists").select("id", { count: "exact", head: true }).eq("user_id", userId),
    serviceClient.from("play_history").select("id", { count: "exact", head: true }).eq("user_id", userId),
    serviceClient.from("liked_songs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    serviceClient.from("saved_albums").select("id", { count: "exact", head: true }).eq("user_id", userId),
    serviceClient.from("favorite_artists").select("id", { count: "exact", head: true }).eq("user_id", userId),
    serviceClient.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId),
    serviceClient.from("playlists").select("id,name,visibility,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(RECENT_LIMIT),
    serviceClient.from("play_history").select("id,played_at,event_type,listened_seconds,duration_seconds,track_data").eq("user_id", userId).order("played_at", { ascending: false }).limit(RECENT_LIMIT),
    serviceClient.from("liked_songs").select("id,liked_at,track_data").eq("user_id", userId).order("liked_at", { ascending: false }).limit(RECENT_LIMIT),
    serviceClient.from("saved_albums").select("id,album_title,album_artist,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(RECENT_LIMIT),
    serviceClient.from("favorite_artists").select("id,artist_name,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(RECENT_LIMIT),
    serviceClient.from("notifications").select("id,type,title,is_read,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(RECENT_LIMIT),
  ]);

  if (profileResponse.error) throw new Error(profileResponse.error.message);
  if (authResponse.error) throw new Error(authResponse.error.message);
  if (currentStatusResponse.error) throw new Error(currentStatusResponse.error.message);
  if (playlistsRecent.error) throw new Error(playlistsRecent.error.message);
  if (playHistoryRecent.error) throw new Error(playHistoryRecent.error.message);
  if (likedSongsRecent.error) throw new Error(likedSongsRecent.error.message);
  if (savedAlbumsRecent.error) throw new Error(savedAlbumsRecent.error.message);
  if (favoriteArtistsRecent.error) throw new Error(favoriteArtistsRecent.error.message);
  if (notificationsRecent.error) throw new Error(notificationsRecent.error.message);

  const authUser = authResponse.data.user;
  const profile = profileResponse.data as ProfileRow | null;

  return {
    user: {
      user_id: userId,
      email: authUser?.email ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      created_at: authUser?.created_at ?? profile?.created_at ?? null,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      profile_visibility: normalizeVisibility(profile?.profile_visibility),
      live_status_visibility: normalizeVisibility(profile?.live_status_visibility),
    },
    currentStatus: currentStatusResponse.data,
    counts: {
      playlists: playlistsCount.count ?? 0,
      playHistory: playHistoryCount.count ?? 0,
      likedSongs: likedSongsCount.count ?? 0,
      savedAlbums: savedAlbumsCount.count ?? 0,
      favoriteArtists: favoriteArtistsCount.count ?? 0,
      notifications: notificationsCount.count ?? 0,
    },
    recent: {
      playlists: playlistsRecent.data ?? [],
      playHistory: playHistoryRecent.data ?? [],
      likedSongs: likedSongsRecent.data ?? [],
      savedAlbums: savedAlbumsRecent.data ?? [],
      favoriteArtists: favoriteArtistsRecent.data ?? [],
      notifications: notificationsRecent.data ?? [],
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return json(401, { error: "Unauthorized" });
  }

  const authenticatedUser = await getAuthenticatedUser(token);
  if (!authenticatedUser || !hasAdminRole(authenticatedUser)) {
    return json(403, { error: "Admin access required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "Server not configured" });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "searchUsers") {
      const query = typeof body.query === "string" ? body.query : "";
      const page = typeof body.page === "number" && Number.isFinite(body.page) && body.page > 0
        ? Math.floor(body.page)
        : 1;

      const [summary, searchResults] = await Promise.all([
        getSummary(serviceClient),
        runUserSearch(serviceClient, query, page),
      ]);

      return json(200, {
        summary,
        users: searchResults.users,
        page,
        has_more: searchResults.hasMore,
      });
    }

    if (action === "getUserAudit") {
      const userId = typeof body.userId === "string" ? body.userId.trim() : "";
      if (!userId) {
        return json(400, { error: "userId is required" });
      }

      const audit = await getUserAuditPayload(serviceClient, userId);
      return json(200, { audit });
    }

    return json(400, { error: "Unknown action" });
  } catch (error) {
    console.error("admin-audit error", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Unexpected error",
    });
  }
});
