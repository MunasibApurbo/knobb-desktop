import { useAuth } from "@/contexts/AuthContext";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useFavoriteArtists } from "@/hooks/useFavoriteArtists";
import { User, Music, Heart, ListMusic, Clock, Loader2, LogOut, Save, Star, Settings, MoreHorizontal, BarChart3, Disc3, TrendingUp } from "lucide-react";
import { PlayHistoryEntry, usePlayHistory } from "@/hooks/usePlayHistory";
import { Track } from "@/types/music";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageTransition } from "@/components/PageTransition";
import { motion, useScroll } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/utils/cropImage";
import { searchArtists, getTidalImageUrl } from "@/lib/monochromeApi";

export type StatsRange = "7d" | "30d" | "all";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { getHistory } = usePlayHistory();
  const { playlists } = usePlaylists();
  const { likedSongs } = useLikedSongs();
  const { favoriteArtists } = useFavoriteArtists();
  const navigate = useNavigate();
  const [historyCount, setHistoryCount] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cropper State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [localHeroImage, setLocalHeroImage] = useState<string | null>(null);

  // Stats State
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const [range, setRange] = useState<StatsRange>("30d");
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});

  const { scrollY } = useScroll();

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    Promise.all([
      getHistory(1000).then(setHistory),
      supabase
        .from("play_history")
        .select("id", { count: "exact", head: true })
        .then(({ count }) => setHistoryCount(count || 0)),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          const profileName = data?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "User";
          setDisplayName(profileName);
          setDraftDisplayName(profileName);
        }),
    ]).finally(() => setLoading(false));
  }, [user, getHistory]);

  const filteredHistory = useMemo(() => {
    if (range === "all") return history;
    const cutoffDays = range === "7d" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - cutoffDays);
    return history.filter((entry) => new Date(entry.playedAt) >= cutoff);
  }, [history, range]);

  const stats = useMemo(() => {
    const totalListenedSeconds = filteredHistory.reduce((s, t) => s + t.listenedSeconds, 0);
    const totalMinutes = Math.round(totalListenedSeconds / 60);
    const artistCounts: Record<string, number> = {};
    const trackCounts: Record<string, { track: Track; count: number }> = {};
    const hourCounts = new Array(24).fill(0);

    filteredHistory.forEach((t) => {
      artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
      if (!trackCounts[t.id]) trackCounts[t.id] = { track: t, count: 0 };
      trackCounts[t.id].count++;
      const hour = new Date(t.playedAt).getHours();
      hourCounts[hour]++;
    });

    const topArtists = Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const topTracks = Object.values(trackCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    return { totalMinutes, totalTracks: filteredHistory.length, topArtists, topTracks, peakHour, hourCounts };
  }, [filteredHistory]);

  useEffect(() => {
    let cancelled = false;

    const fetchArtistImages = async () => {
      const newImages: Record<string, string> = { ...artistImages };
      let updated = false;

      for (const [artist] of stats.topArtists) {
        if (!newImages[artist]) {
          try {
            const results = await searchArtists(artist, 1);
            if (results.length > 0 && results[0].picture) {
              newImages[artist] = getTidalImageUrl(results[0].picture, "320x320");
              updated = true;
            } else {
              newImages[artist] = ""; // Mark as not found
            }
          } catch (e) {
            console.warn(`Failed to fetch image for artist ${artist}:`, e);
          }
        }
      }

      if (updated && !cancelled) {
        setArtistImages(newImages);
      }
    };

    if (stats.topArtists.length > 0) {
      fetchArtistImages();
    }

    return () => { cancelled = true; };
  }, [stats.topArtists]);

  const maxHour = Math.max(...stats.hourCounts, 1);

  const saveProfile = async () => {
    if (!user) return;
    const nextName = draftDisplayName.trim();
    if (!nextName) {
      toast.error("Display name cannot be empty.");
      return;
    }
    if (nextName === displayName) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, display_name: nextName },
        { onConflict: "user_id" }
      );
    setSaving(false);

    if (error) {
      toast.error("Failed to update profile name.");
      return;
    }

    setDisplayName(nextName);
    setIsRenameDialogOpen(false);
    toast.success("Profile updated.");
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string);
      setIsCropDialogOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const showCroppedImage = useCallback(async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        0
      );
      setLocalHeroImage(croppedImage);
      setIsCropDialogOpen(false);
      setImageSrc(null);
      toast.success("Cover image updated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to crop image.");
    }
  }, [imageSrc, croppedAreaPixels]);

  const openImagePicker = () => {
    fileInputRef.current?.click();
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center h-full">
        <User className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-6">Sign in to view your profile.</p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center h-full min-h-[50vh]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const heroImage = localHeroImage || favoriteArtists[0]?.artist_image_url || likedSongs[0]?.coverUrl || null;

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="pb-32 w-full h-full">
        {/* Hero Banner - scroll parallax zoom + blur */}
        {(() => {
          const scrollScale = 1 + scrollY.get() * 0.001;
          const scrollBlur = Math.min(scrollY.get() * 0.05, 12);
          const scrollOpacity = Math.max(1 - scrollY.get() * 0.002, 0.4);

          return (
            <div className="relative overflow-hidden mb-0 border-b border-white/5 bg-[#121212]" style={{ height: "320px" }}>
              <div className="absolute top-6 right-6 z-30 pointer-events-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-10 h-10 flex items-center justify-center  bg-black/20 hover:bg-black/40 backdrop-blur-md transition-colors text-white border border-white/10">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border/30">
                    <DropdownMenuItem onClick={() => {
                      setDraftDisplayName(displayName);
                      setIsRenameDialogOpen(true);
                    }}>
                      Edit Display Name
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openImagePicker}>
                      Change Cover Image
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={async () => {
                      await signOut();
                      navigate("/auth");
                    }} className="text-red-500">
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div
                className="absolute inset-0 z-[1]"
                style={{
                  background: `linear-gradient(to right, hsl(var(--dynamic-accent) / 0.35) 0%, hsl(var(--dynamic-accent) / 0.1) 60%, transparent 85%),
                               linear-gradient(to top, hsl(var(--background)) 0%, transparent 40%)`,
                }}
              />

              {heroImage ? (
                <img
                  src={heroImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover transition-[filter] duration-100 mix-blend-overlay"
                  style={{
                    opacity: 0.6,
                    transform: `scale(${scrollScale + 0.5})`,
                    filter: `blur(${40 + scrollBlur}px)`,
                  }}
                />
              ) : (
                <div
                  className="absolute inset-0 opacity-40 mix-blend-overlay"
                  style={{ background: `linear-gradient(135deg, hsl(var(--dynamic-accent) / 0.9), hsl(var(--dynamic-accent) / 0.35))` }}
                />
              )}

              <div className="relative h-full z-[2] flex items-end">
                {heroImage && (
                  <div className="absolute top-0 right-0 bottom-0 w-full sm:w-[65%] shrink-0 z-0">
                    <img
                      src={heroImage}
                      alt={displayName}
                      className="h-full w-full object-cover object-top transition-[filter,transform] duration-100 opacity-60 mix-blend-overlay"
                      style={{
                        transform: `scale(${scrollScale})`,
                        filter: `blur(${scrollBlur}px)`,
                        maskImage: "linear-gradient(to left, black 20%, transparent 90%), linear-gradient(to top, transparent 0%, black 25%)",
                        WebkitMaskImage: "linear-gradient(to left, black 20%, transparent 90%), linear-gradient(to top, transparent 0%, black 25%)",
                        maskComposite: "intersect",
                        WebkitMaskComposite: "source-in",
                      }}
                    />
                  </div>
                )}

                <div className="relative z-10 w-full flex flex-row items-center md:items-end px-6 sm:px-10 pb-6 sm:pb-10 min-w-0 pointer-events-none">
                  <div className="flex-1 min-w-0 pb-1 pointer-events-auto">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-white/80 mb-1">PROFILE</p>
                    <h1
                      className="text-3xl sm:text-5xl md:text-6xl font-black text-white truncate leading-none mb-2 tracking-tight"
                      style={{ opacity: scrollOpacity, textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
                    >
                      {displayName}
                    </h1>
                    <p className="text-xs sm:text-sm text-white/70 truncate">{user.email}</p>
                    <p className="text-[10px] sm:text-xs text-white/50 mt-0.5">
                      Member since {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}



        {/* Main Content Areas */}
        <div className="w-full pb-10">
          <section className="flex flex-col w-full border-b border-white/10">
            {/* Header */}
            <div className="px-4 md:px-6 h-14 flex items-center justify-between border-b border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="w-5 h-5" style={{ color: `hsl(var(--dynamic-accent))` }} />
                Listening Stats
              </h2>
              <div className="flex items-center gap-1">
                {[
                  { value: "7d", label: "7D" },
                  { value: "30d", label: "30D" },
                  { value: "all", label: "All" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setRange(option.value as StatsRange)}
                    className={`px-3 py-1 text-xs font-semibold transition-colors ${range === option.value
                      ? "text-foreground bg-white/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Overview cards - 3 columns */}
            <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10 bg-white/[0.02]">
              {[
                { icon: Music, label: "Tracks Played", value: stats.totalTracks.toString() },
                { icon: Clock, label: "Minutes Listened", value: stats.totalMinutes.toString() },
                { icon: TrendingUp, label: "Peak Hour", value: `${String(stats.peakHour).padStart(2, "0")}:00` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="group flex flex-col items-center justify-center p-6 sm:p-8 hover:bg-white/[0.04] transition-colors">
                  <Icon className="w-6 h-6 sm:w-8 sm:h-8 mb-3 text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent))] transition-colors duration-300" />
                  <p className="text-2xl sm:text-3xl font-bold text-foreground leading-none mb-1">{value}</p>
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>

            {/* Listening activity by hour */}
            <div className="border-b border-white/10 bg-white/[0.02] flex flex-col group">
              <div className="px-4 md:px-6 h-14 border-b border-white/10 flex items-center">
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
                  Activity by Hour
                </h2>
              </div>
              <div className="px-4 md:px-6 py-6 pb-4">
                <div className="flex items-end gap-[2px] h-32 sm:h-40">
                  {stats.hourCounts.map((count, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group/bar cursor-default h-full justify-end">
                      <div
                        className="w-full transition-all duration-300 group-hover/bar:bg-[hsl(var(--dynamic-accent))] group-hover/bar:scale-y-[1.05] origin-bottom"
                        style={{
                          height: `${(count / maxHour) * 100}%`,
                          minHeight: count > 0 ? 2 : 0,
                          backgroundColor: `hsl(var(--dynamic-accent) / ${0.3 + (count / maxHour) * 0.7})`,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground/50 pt-3 mt-1 font-mono uppercase tracking-wider">
                  <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                </div>
              </div>
            </div>

            {/* Top Artists & Top Tracks grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 bg-white/[0.02]">
              {/* Top Artists */}
              <div className="flex flex-col">
                <div className="px-4 md:px-6 h-14 border-b border-white/10 flex items-center">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Disc3 className="w-4 h-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
                    Top Artists
                  </h2>
                </div>
                {stats.topArtists.length === 0 ? (
                  <div className="p-6">
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {stats.topArtists.map(([artist, count], i) => (
                      <div key={artist} className="group relative overflow-hidden flex items-center gap-4 px-4 md:px-6 py-3 border-b border-white/10 last:border-b-0 hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => navigate(`/artist/search?name=${encodeURIComponent(artist)}`)}>
                        <span
                          className="absolute inset-0 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out pointer-events-none"
                          style={{ backgroundColor: "hsl(var(--player-waveform) / 0.95)" }}
                        />
                        <span className="relative z-10 text-xs font-mono tabular-nums text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors w-4">{i + 1}.</span>
                        {artistImages[artist] ? (
                          <img src={artistImages[artist]} alt={artist} className="relative z-10 w-10 h-10 object-cover shrink-0" />
                        ) : (
                          <div className="relative z-10 w-10 h-10 bg-white/5 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.7)] transition-colors" />
                          </div>
                        )}
                        <div className="relative z-10 flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors">{artist}</p>
                        </div>
                        <span className="relative z-10 text-xs font-mono text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors">{count} plays</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Tracks */}
              <div className="flex flex-col">
                <div className="px-4 md:px-6 h-14 border-b border-white/10 flex items-center">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Music className="w-4 h-4" style={{ color: `hsl(var(--dynamic-accent))` }} />
                    Top Tracks
                  </h2>
                </div>
                {stats.topTracks.length === 0 ? (
                  <div className="p-6">
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {stats.topTracks.map(({ track, count }, i) => (
                      <div key={track.id} className="group relative overflow-hidden flex items-center gap-4 px-4 md:px-6 py-3 border-b border-white/10 last:border-b-0 hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => navigate(`/album/tidal-${track.albumId}?title=${encodeURIComponent(track.album || "")}&artist=${encodeURIComponent(track.artist || "")}`)}>
                        <span
                          className="absolute inset-0 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out pointer-events-none"
                          style={{ backgroundColor: "hsl(var(--player-waveform) / 0.95)" }}
                        />
                        <span className="relative z-10 text-xs font-mono tabular-nums text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors w-4">{i + 1}.</span>
                        <img src={track.coverUrl} alt="" className="relative z-10 w-10 h-10 object-cover shrink-0" />
                        <div className="relative z-10 flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors">{track.title}</p>
                          <p className="text-xs text-muted-foreground truncate group-hover:text-[hsl(var(--dynamic-accent-foreground)/0.85)] transition-colors">{track.artist}</p>
                        </div>
                        <span className="relative z-10 text-xs font-mono text-muted-foreground group-hover:text-[hsl(var(--dynamic-accent-foreground))] transition-colors">{count} plays</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </motion.div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Profile Name</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={draftDisplayName}
              onChange={(e) => setDraftDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full focus-visible:ring-[hsl(var(--player-waveform))]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftDisplayName.trim() && draftDisplayName !== displayName) {
                  saveProfile();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveProfile}
              disabled={saving || draftDisplayName.trim().length === 0 || draftDisplayName.trim() === displayName}
              style={{ backgroundColor: "hsl(var(--player-waveform))", color: "white" }}
              className="hover:opacity-90"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crop Dialog */}
      <Dialog open={isCropDialogOpen} onOpenChange={(open) => {
        setIsCropDialogOpen(open);
        if (!open) setImageSrc(null);
      }}>
        <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 overflow-hidden bg-black border-white/10">
          <DialogHeader className="p-6 border-b border-white/10 z-10 bg-background/80 backdrop-blur-md">
            <DialogTitle>Crop Cover Image</DialogTitle>
          </DialogHeader>
          <div className="relative flex-1 bg-black w-full min-h-[300px]">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={21 / 9}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                showGrid={true}
                classes={{ containerClassName: "absolute inset-0" }}
              />
            )}
          </div>
          <DialogFooter className="p-6 border-t border-white/10 bg-background/80 backdrop-blur-md z-10 flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="flex-1 flex items-center justify-start gap-3 w-full sm:w-auto">
              {/* Zoom Control Slider */}
              <span className="text-xs text-muted-foreground mr-1">Zoom</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => {
                  setZoom(Number(e.target.value))
                }}
                className="w-32 accent-white"
              />
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <Button variant="ghost" onClick={() => setIsCropDialogOpen(false)} className="hover:bg-white/10">
                Cancel
              </Button>
              <Button onClick={showCroppedImage} className="bg-white text-black hover:bg-white/90">
                Set Cover Image
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
