import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { LikedSongsProvider } from "@/contexts/LikedSongsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { FavoriteArtistsProvider } from "@/contexts/FavoriteArtistsContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LocalFilesProvider } from "@/contexts/LocalFilesContext";
import { Layout } from "@/components/Layout";
import { MetadataProvider } from "@/components/MetadataProvider";
import { RequireAdmin, RequireAuth } from "@/components/RequireAuth";
import { PlaylistsProvider } from "@/hooks/usePlaylists";
import { useLowEndDevice } from "@/lib/performanceProfile";


const Index = lazy(() => import("./pages/Index"));
const AlbumPage = lazy(() => import("./pages/AlbumPage"));
const PlaylistPage = lazy(() => import("./pages/PlaylistPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ArtistPage = lazy(() => import("./pages/ArtistPage"));
const ArtistMixPage = lazy(() => import("./pages/ArtistMixPage"));
const TrackMixPage = lazy(() => import("./pages/TrackMixPage"));
const TrackEmbedPage = lazy(() => import("./pages/TrackEmbedPage"));
const TrackSharePage = lazy(() => import("./pages/TrackSharePage"));
const GenrePage = lazy(() => import("./pages/GenrePage"));
const BrowsePage = lazy(() => import("./pages/BrowsePage"));
const HomeSectionPage = lazy(() => import("./pages/HomeSectionPage"));
const UnreleasedPage = lazy(() => import("./pages/UnreleasedPage"));
const UnreleasedArtistPage = lazy(() => import("./pages/UnreleasedArtistPage"));
const UnreleasedProjectPage = lazy(() => import("./pages/UnreleasedProjectPage"));
const LikedSongsPage = lazy(() => import("./pages/LikedSongsPage"));
const LocalFilesPage = lazy(() => import("./pages/LocalFilesPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const UserPlaylistPage = lazy(() => import("./pages/UserPlaylistPage"));
const SharedPlaylistPage = lazy(() => import("./pages/SharedPlaylistPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ListeningStatsPage = lazy(() => import("./pages/ListeningStatsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const FavoriteArtistsPage = lazy(() => import("./pages/FavoriteArtistsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CookiesPage = lazy(() => import("./pages/CookiesPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LazyToaster = lazy(async () => {
  const module = await import("@/components/ui/toaster");
  return { default: module.Toaster };
});
const LazySonner = lazy(async () => {
  const module = await import("@/components/ui/sonner");
  return { default: module.Toaster };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const RouteLoader = () => (
  <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
    Loading...
  </div>
);

function useDeferredChromeMount() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (enabled || typeof window === "undefined") return;

    const activate = () => setEnabled(true);

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(activate, { timeout: 1500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(activate, 900);
    return () => window.clearTimeout(timeoutId);
  }, [enabled]);

  return enabled;
}

const App = () => {
  const lowEndDevice = useLowEndDevice();
  const deferredChromeReady = useDeferredChromeMount();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {deferredChromeReady ? (
          <Suspense fallback={null}>
            <LazyToaster />
            <LazySonner />
          </Suspense>
        ) : null}
        {deferredChromeReady && !lowEndDevice ? <div className="noise-bg fixed inset-0" /> : null}
        <AuthProvider>
          <LanguageProvider>
            <SettingsProvider>
              <LocalFilesProvider>
                <PlayerProvider>
                  <LikedSongsProvider>
                    <FavoriteArtistsProvider>
                      <PlaylistsProvider>
                        <BrowserRouter>
                          <MetadataProvider>
                            <SearchProvider>
                              <Layout>
                                <Suspense fallback={<RouteLoader />}>
                                  <Routes>
                                    <Route path="/" element={<Index />} />
                                    <Route path="/album/:id" element={<AlbumPage />} />
                                    <Route path="/playlist/:id" element={<PlaylistPage />} />
                                    <Route path="/my-playlist/:id" element={<RequireAuth><UserPlaylistPage /></RequireAuth>} />
                                    <Route path="/shared-playlist/:token" element={<SharedPlaylistPage />} />
                                    <Route path="/track/:trackId" element={<TrackSharePage />} />
                                    <Route path="/embed/track/:trackId" element={<TrackEmbedPage />} />
                                    <Route path="/embed-player/track/:trackId" element={<TrackEmbedPage />} />
                                    <Route path="/search" element={<SearchPage />} />
                                    <Route path="/mix/:mixId" element={<TrackMixPage />} />
                                    <Route path="/artist/:id/mix" element={<ArtistMixPage />} />
                                    <Route path="/artist/:id" element={<ArtistPage />} />
                                    <Route path="/genre" element={<GenrePage />} />
                                    <Route path="/browse" element={<BrowsePage />} />
                                    <Route path="/home-section/:section" element={<HomeSectionPage />} />
                                    <Route path="/unreleased" element={<UnreleasedPage />} />
                                    <Route path="/unreleased/:sheetId/:projectName" element={<UnreleasedProjectPage />} />
                                    <Route path="/unreleased/:sheetId" element={<UnreleasedArtistPage />} />
                                    <Route path="/liked" element={<RequireAuth><LikedSongsPage /></RequireAuth>} />
                                    <Route path="/local-files" element={<LocalFilesPage />} />
                                    <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
                                    <Route path="/auth" element={<AuthPage />} />
                                    <Route path="/settings" element={<SettingsPage />} />
                                    <Route path="/stats" element={<RequireAuth><ListeningStatsPage /></RequireAuth>} />
                                    <Route path="/favorite-artists" element={<RequireAuth><FavoriteArtistsPage /></RequireAuth>} />
                                    <Route path="/notifications" element={<NotificationsPage />} />
                                    <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                                    <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
                                    <Route path="/legal/privacy" element={<PrivacyPage />} />
                                    <Route path="/legal/terms" element={<TermsPage />} />
                                    <Route path="/legal/cookies" element={<CookiesPage />} />
                                    <Route path="*" element={<NotFound />} />
                                  </Routes>
                                </Suspense>
                              </Layout>
                            </SearchProvider>
                          </MetadataProvider>
                        </BrowserRouter>
                      </PlaylistsProvider>
                    </FavoriteArtistsProvider>
                  </LikedSongsProvider>
                </PlayerProvider>
              </LocalFilesProvider>
            </SettingsProvider>
          </LanguageProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
