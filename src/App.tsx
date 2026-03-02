import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { LikedSongsProvider } from "@/contexts/LikedSongsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import AlbumPage from "./pages/AlbumPage";
import PlaylistPage from "./pages/PlaylistPage";
import SearchPage from "./pages/SearchPage";
import ArtistPage from "./pages/ArtistPage";
import GenrePage from "./pages/GenrePage";
import LikedSongsPage from "./pages/LikedSongsPage";
import HistoryPage from "./pages/HistoryPage";
import UserPlaylistPage from "./pages/UserPlaylistPage";
import AuthPage from "./pages/AuthPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <PlayerProvider>
          <LikedSongsProvider>
            <BrowserRouter>
              <SearchProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/album/:id" element={<AlbumPage />} />
                    <Route path="/playlist/:id" element={<PlaylistPage />} />
                    <Route path="/my-playlist/:id" element={<UserPlaylistPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/artist/:id" element={<ArtistPage />} />
                    <Route path="/genre" element={<GenrePage />} />
                    <Route path="/liked" element={<LikedSongsPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </SearchProvider>
            </BrowserRouter>
          </LikedSongsProvider>
        </PlayerProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
