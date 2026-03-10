import { ArrowRight, Disc3, Pause, Play, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ArtistCardWrapper, HomeAlbumCard, TrackCard } from "@/components/home/HomeMediaCards";
import {
  MOBILE_ACTION_BUTTON_CLASS,
  MOBILE_SECONDARY_BUTTON_CLASS,
  MobileExperiencePage,
  MobileHero,
  MobileMetaChip,
  MobileRail,
  MobileSection,
  MobileStatPill,
} from "@/components/mobile/MobileExperienceLayout";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/contexts/PlayerContext";
import { triggerImpactHaptic, triggerSelectionHaptic } from "@/lib/haptics";
import { isSameTrack } from "@/lib/trackIdentity";
import type { HomeAlbum, HomeArtist } from "@/hooks/useHomeFeeds";
import type { Track } from "@/types/music";

type ToggleSavedAlbumInput = {
  albumArtist: string;
  albumCoverUrl: string;
  albumId: number;
  albumTitle: string;
  albumYear?: number | null;
};

type MobileHomeExperienceProps = {
  newReleases: HomeAlbum[];
  recommendedAlbums: HomeAlbum[];
  recommendedArtists: HomeArtist[];
  recommendedTracks: Track[];
  recentTracks: Track[];
  userId?: string | null;
  isAlbumSaved: (albumId: number) => boolean;
  isTrackLiked: (trackId: string) => boolean;
  onToggleLike: (track: Track) => void;
  onToggleSavedAlbum: (album: ToggleSavedAlbumInput) => void | Promise<unknown>;
};

function parseAlbumYear(releaseDate?: string) {
  if (!releaseDate) return null;
  const year = new Date(releaseDate).getFullYear();
  return Number.isFinite(year) ? year : null;
}

export function MobileHomeExperience({
  newReleases,
  recommendedAlbums,
  recommendedArtists,
  recommendedTracks,
  recentTracks,
  userId,
  isAlbumSaved,
  isTrackLiked,
  onToggleLike,
  onToggleSavedAlbum,
}: MobileHomeExperienceProps) {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, play, togglePlay } = usePlayer();
  const continueTrack = recentTracks[0] ?? recommendedTracks[0] ?? null;
  const continueQueue = recentTracks.length > 0 ? recentTracks : recommendedTracks;
  const featuredAlbum = newReleases[0] ?? recommendedAlbums[0] ?? null;
  const spotlightAlbums = (newReleases.length > 0 ? newReleases : recommendedAlbums).slice(1, 6);
  const libraryMood = userId ? "Your richest listening canvas" : "Search deeply, then keep what matters";
  const isContinuingCurrent = continueTrack ? isSameTrack(currentTrack, continueTrack) : false;

  return (
    <MobileExperiencePage
      artworkUrl={continueTrack?.coverUrl || featuredAlbum?.coverUrl}
      accentColor={continueTrack?.canvasColor}
      className="home-page-surface"
    >
      <MobileHero
        artworkAlt={continueTrack?.title || "Knobb home"}
        artworkUrl={continueTrack?.coverUrl || featuredAlbum?.coverUrl}
        accentColor={continueTrack?.canvasColor}
        eyebrow="Knobb Mobile"
        title={continueTrack ? continueTrack.title : "Keep the color moving."}
        description={
          <div className="space-y-3">
            <p className="max-w-[26rem] text-sm leading-6 text-white/76">
              {continueTrack
                ? `${continueTrack.artist} • ${continueTrack.album}`
                : "Premium motion, quicker browsing, and album art that drives the atmosphere."}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/44">
              {libraryMood}
            </p>
          </div>
        }
        meta={
          <>
            <MobileMetaChip label="Mode" value="Premium" />
            <MobileMetaChip label="Feel" value="Rich" />
            <MobileMetaChip label="Focus" value="Playback-first" />
          </>
        }
        actions={
          <>
            <Button
              variant="ghost"
              className={MOBILE_ACTION_BUTTON_CLASS}
              onClick={() => {
                triggerImpactHaptic("medium");
                if (!continueTrack) {
                  navigate("/search");
                  return;
                }

                if (isContinuingCurrent) {
                  togglePlay();
                  return;
                }

                play(continueTrack, continueQueue);
              }}
            >
              {isContinuingCurrent && isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              {continueTrack ? "Resume Session" : "Start Listening"}
            </Button>
            <Button
              variant="ghost"
              className={MOBILE_SECONDARY_BUTTON_CLASS}
              onClick={() => {
                triggerSelectionHaptic();
                navigate("/search");
              }}
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
            <Button
              variant="ghost"
              className={MOBILE_SECONDARY_BUTTON_CLASS}
              onClick={() => {
                triggerSelectionHaptic();
                navigate("/browse");
              }}
            >
              <Sparkles className="h-4 w-4" />
              Browse
            </Button>
            <Button
              variant="ghost"
              className={MOBILE_SECONDARY_BUTTON_CLASS}
              onClick={() => {
                triggerSelectionHaptic();
                navigate(userId ? "/library" : "/auth");
              }}
            >
              <Disc3 className="h-4 w-4" />
              {userId ? "Open Library" : "Sign In"}
            </Button>
          </>
        }
        footer={
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MobileStatPill label="Tracks" value={recommendedTracks.length} />
            <MobileStatPill label="Albums" value={recommendedAlbums.length + newReleases.length} />
            <MobileStatPill label="Artists" value={recommendedArtists.length} />
            <MobileStatPill label="Ready" value={userId ? "Saved" : "Guest"} />
          </div>
        }
      />

      {recommendedTracks.length > 0 ? (
        <MobileSection
          eyebrow="Fast lane"
          title="Picked For You"
          action={
            <button
              type="button"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58 transition-colors hover:text-white"
              onClick={() => {
                triggerSelectionHaptic();
                navigate("/search");
              }}
            >
              Explore
            </button>
          }
        >
          <MobileRail itemClassName="w-[min(72vw,18rem)]">
            {recommendedTracks.map((track, index) => (
              <TrackCard
                key={`mobile-rec-track-${track.id}`}
                track={track}
                tracks={recommendedTracks}
                liked={isTrackLiked(track.id)}
                onToggleLike={() => onToggleLike(track)}
                isPriority={index < 4}
              />
            ))}
          </MobileRail>
        </MobileSection>
      ) : null}

      {featuredAlbum ? (
        <MobileSection
          eyebrow="Editorial drop"
          title="New Releases"
          action={
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58 transition-colors hover:text-white"
              onClick={() => {
                triggerSelectionHaptic();
                navigate("/browse");
              }}
            >
              Browse
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          }
          contentClassName="space-y-4 px-4 pb-4"
        >
          <button
            type="button"
            className="group relative w-full overflow-hidden rounded-[26px] border border-white/10 text-left"
            onClick={() => navigate(`/album/tidal-${featuredAlbum.id}?title=${encodeURIComponent(featuredAlbum.title)}&artist=${encodeURIComponent(featuredAlbum.artist || "Various Artists")}`)}
          >
            <img src={featuredAlbum.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.68)_42%,rgba(0,0,0,0.94))]" />
            <div className="relative z-10 flex min-h-[15rem] flex-col justify-end gap-3 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/48">Featured album</p>
                <p className="mt-2 text-[1.65rem] font-black leading-[0.92] tracking-[-0.06em] text-white">{featuredAlbum.title}</p>
                <p className="mt-2 text-sm text-white/68">{featuredAlbum.artist || "Various Artists"}</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">
                <span>Color-forward playback</span>
                {featuredAlbum.releaseDate ? <span>{parseAlbumYear(featuredAlbum.releaseDate)}</span> : null}
              </div>
            </div>
          </button>

          {spotlightAlbums.length > 0 ? (
            <MobileRail itemClassName="w-[min(72vw,18rem)]">
              {spotlightAlbums.map((album, index) => (
                <HomeAlbumCard
                  key={`mobile-spotlight-album-${album.id}`}
                  album={album}
                  saved={isAlbumSaved(album.id)}
                  onToggleSave={() => {
                    void onToggleSavedAlbum({
                      albumId: album.id,
                      albumTitle: album.title,
                      albumArtist: album.artist || "Various Artists",
                      albumCoverUrl: album.coverUrl,
                      albumYear: parseAlbumYear(album.releaseDate),
                    });
                  }}
                  isPriority={index < 3}
                />
              ))}
            </MobileRail>
          ) : null}
        </MobileSection>
      ) : null}

      {recommendedArtists.length > 0 ? (
        <MobileSection eyebrow="Keep close" title="Artists In Orbit">
          <MobileRail itemClassName="w-[min(68vw,17rem)]">
            {recommendedArtists.map((artist, index) => (
              <ArtistCardWrapper
                key={`mobile-rec-artist-${artist.id}`}
                artist={artist}
                isPriority={index < 4}
              />
            ))}
          </MobileRail>
        </MobileSection>
      ) : null}

      {recentTracks.length > 0 ? (
        <MobileSection eyebrow="Return path" title="Back In Rotation">
          <MobileRail itemClassName="w-[min(72vw,18rem)]">
            {recentTracks.map((track, index) => (
              <TrackCard
                key={`mobile-recent-track-${track.id}`}
                track={track}
                tracks={recentTracks}
                liked={isTrackLiked(track.id)}
                onToggleLike={() => onToggleLike(track)}
                isPriority={index < 4}
              />
            ))}
          </MobileRail>
        </MobileSection>
      ) : null}
    </MobileExperiencePage>
  );
}
