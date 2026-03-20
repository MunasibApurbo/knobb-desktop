import { Suspense, lazy, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
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
import { FavoritePlaylistsProvider } from "@/hooks/useFavoritePlaylists";
import { PlaylistsProvider } from "@/hooks/usePlaylists";
import { SavedAlbumsProvider } from "@/hooks/useSavedAlbums";
import { readStartupPerformanceBudget, scheduleBackgroundTask, useDeferredMount } from "@/lib/performanceProfile";
import { warmInternalRouteModulesInBackground } from "@/lib/routePreload";
import { APP_HOME_PATH } from "@/lib/routes";

const IndexPage = lazy(() => import("./pages/Index"));
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
const ArtistGridPage = lazy(() => import("./pages/ArtistGridPage"));
const ArtistGridTrackerPage = lazy(() => import("./pages/ArtistGridTrackerPage"));
const HomeSectionPage = lazy(() => import("./pages/HomeSectionPage"));
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
const NotFoundPage = lazy(() => import("./pages/NotFound"));
const DeferredSonnerToaster = lazy(async () => {
  const module = await import("@/components/ui/sonner");
  return { default: module.Toaster };
});

function renderDeferredRoute(Page: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}

function InternalRouteWarmupEffect() {
  const location = useLocation();

  useEffect(() => {
    const startupBudget = readStartupPerformanceBudget();
    if (!startupBudget.canPreloadLikelyRoutes) {
      return;
    }

    return scheduleBackgroundTask(() => {
      void warmInternalRouteModulesInBackground(location.pathname).catch(() => undefined);
    }, 1800);
  }, [location.pathname]);

  return null;
}

export default function InternalApp() {
  const deferredChromeReady = useDeferredMount(1500);

  return (
    <>
      {deferredChromeReady ? (
        <Suspense fallback={null}>
          <DeferredSonnerToaster />
        </Suspense>
      ) : null}
      <AuthProvider>
        <LanguageProvider>
          <SettingsProvider>
            <LocalFilesProvider>
              <PlayerProvider>
                <LikedSongsProvider>
                  <FavoriteArtistsProvider>
                    <SavedAlbumsProvider>
                      <FavoritePlaylistsProvider>
                        <PlaylistsProvider>
                          <MetadataProvider>
                            <SearchProvider>
                              <InternalRouteWarmupEffect />
                              <Routes>
                                <Route element={<Layout />}>
                                  <Route path={APP_HOME_PATH} element={renderDeferredRoute(IndexPage)} />
                                  <Route path="/album/:id" element={renderDeferredRoute(AlbumPage)} />
                                  <Route path="/playlist/:id" element={renderDeferredRoute(PlaylistPage)} />
                                  <Route path="/my-playlist/:id" element={<RequireAuth>{renderDeferredRoute(UserPlaylistPage)}</RequireAuth>} />
                                  <Route path="/shared-playlist/:token" element={renderDeferredRoute(SharedPlaylistPage)} />
                                  <Route path="/track/:trackId" element={renderDeferredRoute(TrackSharePage)} />
                                  <Route path="/embed/track/:trackId" element={renderDeferredRoute(TrackEmbedPage)} />
                                  <Route path="/embed-player/track/:trackId" element={renderDeferredRoute(TrackEmbedPage)} />
                                  <Route path="/search" element={renderDeferredRoute(SearchPage)} />
                                  <Route path="/mix/:mixId" element={renderDeferredRoute(TrackMixPage)} />
                                  <Route path="/artist/:id/mix" element={renderDeferredRoute(ArtistMixPage)} />
                                  <Route path="/artist/:id" element={renderDeferredRoute(ArtistPage)} />
                                  <Route path="/genre" element={renderDeferredRoute(GenrePage)} />
                                  <Route path="/browse" element={renderDeferredRoute(BrowsePage)} />
                                  <Route path="/browse/artistgrid" element={renderDeferredRoute(ArtistGridPage)} />
                                  <Route path="/browse/artistgrid/:sheetId" element={renderDeferredRoute(ArtistGridTrackerPage)} />
                                  <Route path="/home-section/:section" element={renderDeferredRoute(HomeSectionPage)} />
                                  <Route path="/liked" element={<RequireAuth>{renderDeferredRoute(LikedSongsPage)}</RequireAuth>} />
                                  <Route path="/local-files" element={renderDeferredRoute(LocalFilesPage)} />
                                  <Route path="/history" element={<RequireAuth>{renderDeferredRoute(HistoryPage)}</RequireAuth>} />
                                  <Route path="/auth" element={renderDeferredRoute(AuthPage)} />
                                  <Route path="/settings" element={renderDeferredRoute(SettingsPage)} />
                                  <Route path="/stats" element={<RequireAuth>{renderDeferredRoute(ListeningStatsPage)}</RequireAuth>} />
                                  <Route path="/favorite-artists" element={<RequireAuth>{renderDeferredRoute(FavoriteArtistsPage)}</RequireAuth>} />
                                  <Route path="/notifications" element={renderDeferredRoute(NotificationsPage)} />
                                  <Route path="/profile" element={<RequireAuth>{renderDeferredRoute(ProfilePage)}</RequireAuth>} />
                                  <Route path="/admin" element={<RequireAdmin>{renderDeferredRoute(AdminPage)}</RequireAdmin>} />
                                  <Route path="/legal/privacy" element={renderDeferredRoute(PrivacyPage)} />
                                  <Route path="/legal/terms" element={renderDeferredRoute(TermsPage)} />
                                  <Route path="/legal/cookies" element={renderDeferredRoute(CookiesPage)} />
                                  <Route path="*" element={renderDeferredRoute(NotFoundPage)} />
                                </Route>
                              </Routes>
                            </SearchProvider>
                          </MetadataProvider>
                        </PlaylistsProvider>
                      </FavoritePlaylistsProvider>
                    </SavedAlbumsProvider>
                  </FavoriteArtistsProvider>
                </LikedSongsProvider>
              </PlayerProvider>
            </LocalFilesProvider>
          </SettingsProvider>
        </LanguageProvider>
      </AuthProvider>
    </>
  );
}
