import { APP_HOME_PATH } from "@/lib/routes";

export type MobileRouteMeta = {
  fallbackHref: string;
  showBackButton: boolean;
  title: string;
};

export function getMobileRouteMeta(pathname: string): MobileRouteMeta {
  if (pathname === APP_HOME_PATH) {
    return {
      title: "Home",
      showBackButton: false,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname === "/search") {
    return {
      title: "Search",
      showBackButton: false,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname === "/library") {
    return {
      title: "Library",
      showBackButton: false,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname === "/browse") {
    return {
      title: "Browse",
      showBackButton: false,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname === "/liked") {
    return {
      title: "Liked Songs",
      showBackButton: true,
      fallbackHref: "/library",
    };
  }

  if (pathname === "/profile") {
    return {
      title: "Profile",
      showBackButton: true,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname === "/notifications") {
    return {
      title: "Notifications",
      showBackButton: true,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname === "/settings") {
    return {
      title: "Settings",
      showBackButton: true,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname === "/genre") {
    return {
      title: "Genre",
      showBackButton: true,
      fallbackHref: "/browse",
    };
  }

  if (pathname.startsWith("/album/")) {
    return {
      title: "Album",
      showBackButton: true,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname.startsWith("/artist/") && pathname.endsWith("/mix")) {
    return {
      title: "Artist Mix",
      showBackButton: true,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname.startsWith("/artist/")) {
    return {
      title: "Artist",
      showBackButton: true,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname.startsWith("/playlist/")) {
    return {
      title: "Playlist",
      showBackButton: true,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname.startsWith("/my-playlist/")) {
    return {
      title: "Your Playlist",
      showBackButton: true,
      fallbackHref: "/library",
    };
  }

  if (pathname.startsWith("/track/")) {
    return {
      title: "Track",
      showBackButton: true,
      fallbackHref: APP_HOME_PATH,
    };
  }

  if (pathname.startsWith("/mix/")) {
    return {
      title: "Mix",
      showBackButton: true,
      fallbackHref: APP_HOME_PATH,
    };
  }

  return {
    title: "Knobb",
    showBackButton: true,
    fallbackHref: APP_HOME_PATH,
  };
}
