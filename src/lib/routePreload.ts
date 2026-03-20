import { APP_HOME_PATH, CONTACT_PATH, PUBLIC_HOME_PATH } from "@/lib/routes";

type RouteModuleLoader = () => Promise<unknown>;

const internalAppLoader: RouteModuleLoader = () => import("@/InternalApp");

const routeModuleLoaders: Array<{
  matches: (pathname: string) => boolean;
  load: RouteModuleLoader;
}> = [
  { matches: (pathname) => pathname === PUBLIC_HOME_PATH, load: () => import("@/pages/LandingPage") },
  { matches: (pathname) => pathname === CONTACT_PATH, load: () => import("@/pages/landing/LandingContactPage") },
  { matches: (pathname) => pathname === APP_HOME_PATH, load: () => import("@/pages/Index") },
  { matches: (pathname) => pathname.startsWith("/album/"), load: () => import("@/pages/AlbumPage") },
  { matches: (pathname) => pathname.startsWith("/playlist/"), load: () => import("@/pages/PlaylistPage") },
  { matches: (pathname) => pathname.startsWith("/my-playlist/"), load: () => import("@/pages/UserPlaylistPage") },
  { matches: (pathname) => pathname.startsWith("/shared-playlist/"), load: () => import("@/pages/SharedPlaylistPage") },
  { matches: (pathname) => pathname.startsWith("/track/"), load: () => import("@/pages/TrackSharePage") },
  { matches: (pathname) => pathname.startsWith("/embed/track/") || pathname.startsWith("/embed-player/track/"), load: () => import("@/pages/TrackEmbedPage") },
  { matches: (pathname) => pathname.startsWith("/search"), load: () => import("@/pages/SearchPage") },

  { matches: (pathname) => pathname.startsWith("/mix/"), load: () => import("@/pages/TrackMixPage") },
  { matches: (pathname) => pathname.startsWith("/artist/") && pathname.endsWith("/mix"), load: () => import("@/pages/ArtistMixPage") },
  { matches: (pathname) => pathname.startsWith("/artist/"), load: () => import("@/pages/ArtistPage") },
  { matches: (pathname) => pathname.startsWith("/genre"), load: () => import("@/pages/GenrePage") },
  { matches: (pathname) => pathname.startsWith("/browse/artistgrid/"), load: () => import("@/pages/ArtistGridTrackerPage") },
  { matches: (pathname) => pathname === "/browse/artistgrid", load: () => import("@/pages/ArtistGridPage") },
  { matches: (pathname) => pathname.startsWith("/browse"), load: () => import("@/pages/BrowsePage") },
  { matches: (pathname) => pathname.startsWith("/home-section/"), load: () => import("@/pages/HomeSectionPage") },
  { matches: (pathname) => pathname.startsWith("/liked"), load: () => import("@/pages/LikedSongsPage") },
  { matches: (pathname) => pathname.startsWith("/local-files"), load: () => import("@/pages/LocalFilesPage") },
  { matches: (pathname) => pathname.startsWith("/history"), load: () => import("@/pages/HistoryPage") },
  { matches: (pathname) => pathname.startsWith("/auth"), load: () => import("@/pages/AuthPage") },
  { matches: (pathname) => pathname.startsWith("/settings"), load: () => import("@/pages/SettingsPage") },
  { matches: (pathname) => pathname.startsWith("/stats"), load: () => import("@/pages/ListeningStatsPage") },
  { matches: (pathname) => pathname.startsWith("/favorite-artists"), load: () => import("@/pages/FavoriteArtistsPage") },
  { matches: (pathname) => pathname.startsWith("/notifications"), load: () => import("@/pages/NotificationsPage") },
  { matches: (pathname) => pathname.startsWith("/profile"), load: () => import("@/pages/ProfilePage") },
  { matches: (pathname) => pathname.startsWith("/admin"), load: () => import("@/pages/AdminPage") },
  { matches: (pathname) => pathname === "/legal/privacy", load: () => import("@/pages/PrivacyPage") },
  { matches: (pathname) => pathname === "/legal/terms", load: () => import("@/pages/TermsPage") },
  { matches: (pathname) => pathname === "/legal/cookies", load: () => import("@/pages/CookiesPage") },
];

const inflightRoutePreloads = new Map<string, Promise<void>>();
let internalRouteWarmupPromise: Promise<void> | null = null;
const BASE_BACKGROUND_ROUTE_PATHS = [
  APP_HOME_PATH,
  "/browse",
  "/search",
] as const;
const LIBRARY_BACKGROUND_ROUTE_PATHS = [
  ...BASE_BACKGROUND_ROUTE_PATHS,
  "/liked",
  "/history",
] as const;
const ACCOUNT_BACKGROUND_ROUTE_PATHS = [
  ...BASE_BACKGROUND_ROUTE_PATHS,
  "/settings",
  "/profile",
  "/notifications",
] as const;
const LANDING_BACKGROUND_ROUTE_PATHS = [
  APP_HOME_PATH,
  "/browse",
  "/search",
  "/auth",
] as const;

function waitForBackgroundSlot(timeout = 1400) {
  return new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => resolve(), { timeout });
      return;
    }

    window.setTimeout(resolve, Math.min(timeout, 900));
  });
}

export function normalizePathname(pathname: string) {
  if (!pathname) return PUBLIC_HOME_PATH;

  if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
    try {
      return new URL(pathname).pathname || PUBLIC_HOME_PATH;
    } catch {
      return PUBLIC_HOME_PATH;
    }
  }

  const [pathOnly] = pathname.split(/[?#]/, 1);
  return pathOnly || PUBLIC_HOME_PATH;
}

export function getPreloadablePathname(target: string | URL | null | undefined) {
  if (!target) return null;

  if (target instanceof URL) {
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return null;
    }

    if (typeof window !== "undefined" && target.origin !== window.location.origin) {
      return null;
    }

    return normalizePathname(target.pathname);
  }

  const trimmedTarget = target.trim();
  if (
    trimmedTarget.length === 0 ||
    trimmedTarget.startsWith("#") ||
    trimmedTarget.startsWith("mailto:") ||
    trimmedTarget.startsWith("tel:") ||
    trimmedTarget.startsWith("javascript:")
  ) {
    return null;
  }

  if (trimmedTarget.startsWith("http://") || trimmedTarget.startsWith("https://")) {
    try {
      return getPreloadablePathname(new URL(trimmedTarget));
    } catch {
      return null;
    }
  }

  return normalizePathname(trimmedTarget);
}

function getRouteLoader(pathname: string) {
  return routeModuleLoaders.find((candidate) => candidate.matches(pathname))?.load ?? (() => import("@/pages/NotFound"));
}

function getRouteLoaders(pathname: string) {
  if (pathname === PUBLIC_HOME_PATH) {
    return [() => import("@/pages/LandingPage")];
  }

  if (pathname === CONTACT_PATH) {
    return [() => import("@/pages/landing/LandingContactPage")];
  }

  return [internalAppLoader, getRouteLoader(pathname)];
}

function getLikelyWarmRoutePaths(currentPathname: string) {
  if (currentPathname === PUBLIC_HOME_PATH || currentPathname === CONTACT_PATH) {
    return LANDING_BACKGROUND_ROUTE_PATHS;
  }

  if (
    currentPathname.startsWith("/settings") ||
    currentPathname.startsWith("/profile") ||
    currentPathname.startsWith("/notifications")
  ) {
    return ACCOUNT_BACKGROUND_ROUTE_PATHS;
  }

  if (
    currentPathname === APP_HOME_PATH ||
    currentPathname.startsWith("/browse") ||
    currentPathname.startsWith("/search") ||
    currentPathname.startsWith("/liked") ||
    currentPathname.startsWith("/history")
  ) {
    return LIBRARY_BACKGROUND_ROUTE_PATHS;
  }

  return BASE_BACKGROUND_ROUTE_PATHS;
}

export function preloadRouteModule(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  const existing = inflightRoutePreloads.get(normalizedPathname);
  if (existing) {
    return existing;
  }

  const preloadPromise = Promise.allSettled(getRouteLoaders(normalizedPathname).map((load) => load()))
    .then(() => undefined)
    .finally(() => {
      inflightRoutePreloads.delete(normalizedPathname);
    });

  inflightRoutePreloads.set(normalizedPathname, preloadPromise);
  return preloadPromise;
}

export function preloadInitialRouteModule(pathname: string) {
  return preloadRouteModule(pathname);
}

export function preloadHrefRoute(target: string | URL | null | undefined) {
  const pathname = getPreloadablePathname(target);
  if (!pathname) {
    return Promise.resolve();
  }

  return preloadRouteModule(pathname);
}

export function warmInternalRouteModulesInBackground(currentPathname = APP_HOME_PATH) {
  if (internalRouteWarmupPromise) {
    return internalRouteWarmupPromise;
  }

  internalRouteWarmupPromise = (async () => {
    const normalizedPathname = normalizePathname(currentPathname);
    const warmRoutePaths = getLikelyWarmRoutePaths(normalizedPathname)
      .filter((pathname) => pathname !== normalizedPathname);
    const backgroundInternalRouteLoaders: RouteModuleLoader[] = [
      internalAppLoader,
      ...warmRoutePaths.map((pathname) => getRouteLoader(pathname)),
    ];

    for (const load of backgroundInternalRouteLoaders) {
      await waitForBackgroundSlot();
      await load().catch(() => undefined);
    }
  })();

  return internalRouteWarmupPromise;
}
