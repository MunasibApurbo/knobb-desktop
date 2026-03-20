import { useState } from "react";
import { Heart, Music, Play, Share, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { usePlayerCommands } from "@/contexts/PlayerContext";
import { getTidalImageUrl, searchArtists } from "@/lib/musicApi";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  buildArtistMixPath,
  buildArtistPath,
  buildArtistSearchPath,
  shareOrCopy,
  toAbsoluteUrl,
} from "@/lib/mediaNavigation";

interface ArtistContextMenuProps {
  artistId?: number | string;
  artistName: string;
  artistImageUrl?: string | null;
  source?: "tidal" | "youtube-music";
  children: React.ReactNode;
}

export function ArtistContextMenu({
  artistId,
  artistName,
  artistImageUrl,
  source = "tidal",
  children,
}: ArtistContextMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playArtist } = usePlayerCommands();
  const { isFavorite, toggleFavorite } = useFavoriteArtists();
  const [isSaving, setIsSaving] = useState(false);
  const [resolvedArtistId, setResolvedArtistId] = useState<number | string | null>(artistId ?? null);
  const [resolvedArtistSource, setResolvedArtistSource] = useState<"tidal" | "youtube-music">(source);
  const [resolvedArtistImageUrl, setResolvedArtistImageUrl] = useState<string | null>(artistImageUrl ?? null);

  const favorite = typeof resolvedArtistId === "number" && resolvedArtistSource === "tidal"
    ? isFavorite(resolvedArtistId)
    : false;

  const resolveArtistReference = async () => {
    if (resolvedArtistId) {
      return {
        id: resolvedArtistId,
        source: resolvedArtistSource,
        imageUrl: resolvedArtistImageUrl || undefined,
      };
    }

    const query = artistName.trim();
    if (!query) return null;

    const results = await searchArtists(query, 8).catch(() => []);
    const normalizedQuery = query.toLowerCase();
    const match =
      results.find((artist) => artist.name.trim().toLowerCase() === normalizedQuery) ||
      results.find((artist) => artist.name.trim().toLowerCase().includes(normalizedQuery)) ||
      results.find((artist) => normalizedQuery.includes(artist.name.trim().toLowerCase()));

    if (!match) return null;

    const nextImageUrl = match.picture ? getTidalImageUrl(match.picture, "1080x720") : resolvedArtistImageUrl || undefined;
    setResolvedArtistId(match.id);
    setResolvedArtistSource("tidal");
    setResolvedArtistImageUrl(nextImageUrl || null);

    return {
      id: match.id,
      source: "tidal",
      imageUrl: nextImageUrl,
    };
  };

  const handleOpenArtist = async () => {
    const resolved = await resolveArtistReference();
    if (!resolved) {
      navigate(buildArtistSearchPath(artistName));
      return;
    }

    navigate(buildArtistPath(resolved.id, artistName, resolved.source as "tidal" | "youtube-music" | "local"));
  };

  const handleOpenArtistMix = async () => {
    const resolved = await resolveArtistReference();
    if (!resolved) {
      toast.error("Artist mix is unavailable");
      navigate(buildArtistSearchPath(artistName));
      return;
    }

    navigate(buildArtistMixPath(resolved.id, artistName, resolved.source as "tidal" | "youtube-music" | "local"));
  };

  const handlePlay = async () => {
    const resolved = await resolveArtistReference();
    if (!resolved) {
      toast.error("Artist not found");
      navigate(buildArtistSearchPath(artistName));
      return;
    }

    await playArtist(resolved.id, artistName);
  };

  const handleToggleFavorite = async () => {
    if (isSaving) return;

    if (resolvedArtistSource !== "tidal") {
      toast.error("Saving favorite artists is currently available for TIDAL artists only");
      return;
    }

    if (!user) {
      navigate("/auth", { state: { from: `${window.location.pathname}${window.location.search}` } });
      return;
    }

    const resolved = await resolveArtistReference();
    if (!resolved) {
      toast.error("Artist not found");
      return;
    }

    setIsSaving(true);
    const success = await toggleFavorite({
      artistId: resolved.id,
      artistName,
      artistImageUrl: resolved.imageUrl || undefined,
    });
    setIsSaving(false);

    if (!success) {
      toast.error("Failed to update favorite artist");
      return;
    }

    toast.success(
      favorite
        ? `Removed ${artistName} from your library`
        : `Saved ${artistName} to your library`,
    );
  };

  const handleShare = async () => {
    const sharePath = resolvedArtistId
      ? buildArtistPath(resolvedArtistId, artistName, resolvedArtistSource)
      : buildArtistSearchPath(artistName);

    await shareOrCopy({
      title: artistName,
      text: artistName,
      url: toAbsoluteUrl(sharePath),
      successMessage: "Artist link copied to clipboard",
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem className="gap-2" onClick={() => void handlePlay()}>
          <Play className="w-4 h-4" /> Play
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={() => void handleToggleFavorite()} disabled={isSaving}>
          <Heart className={`w-4 h-4 ${favorite ? "fill-current text-white" : ""}`} />
          {favorite ? "Remove from Your Library" : "Save to Your Library"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="gap-2" onClick={() => void handleShare()}>
          <Share className="w-4 h-4" /> Share
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={() => void handleOpenArtistMix()}>
          <Music className="w-4 h-4" /> Open Artist Mix
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onClick={() => void handleOpenArtist()}>
          <User className="w-4 h-4" /> Open Artist
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
