import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { LikedSongsProvider } from "@/contexts/LikedSongsContext";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import AlbumPage from "./pages/AlbumPage";
import PlaylistPage from "./pages/PlaylistPage";
import SearchPage from "./pages/SearchPage";
import ArtistPage from "./pages/ArtistPage";
import GenrePage from "./pages/GenrePage";
import LikedSongsPage from "./pages/LikedSongsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PlayerProvider>
        <LikedSongsProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/album/:id" element={<AlbumPage />} />
                <Route path="/playlist/:id" element={<PlaylistPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/artist/:id" element={<ArtistPage />} />
                <Route path="/genre" element={<GenrePage />} />
                <Route path="/liked" element={<LikedSongsPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </LikedSongsProvider>
      </PlayerProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
