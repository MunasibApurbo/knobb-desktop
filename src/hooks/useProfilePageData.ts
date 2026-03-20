import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Area } from "react-easy-crop";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteArtists } from "@/contexts/FavoriteArtistsContext";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { useSettings } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { usePlayHistory, type PlayHistoryEntry } from "@/hooks/usePlayHistory";
import {
  computeListeningStats,
  filterHistoryByRange,
  type ListeningStats,
  type StatsRange,
} from "@/lib/listeningIntelligence";
import { getTidalImageUrl, resolveArtistImageUrl, searchArtists } from "@/lib/musicApi";
import {
  readImageDimensions,
  validateProfileBannerDimensions,
  validateProfileBannerFile,
  validateProfileBannerUploadBlob,
} from "@/lib/profileBannerUpload";
import getCroppedImg from "@/utils/cropImage";

type ProfileRecord = Pick<Tables<"profiles">, "display_name" | "avatar_url">;
type ProfilePatch = Pick<TablesInsert<"profiles">, "display_name" | "avatar_url">;
const PROFILE_COVERS_BUCKET = "profile-covers";

function sanitizePersistedProfileImageUrl(value: string | null | undefined) {
  if (!value) return null;
  if (value.startsWith("blob:")) return null;
  return value;
}

function getStoredProfileCoverPath(value: string | null | undefined) {
  if (!value) return null;

  const marker = `/storage/v1/object/public/${PROFILE_COVERS_BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) return null;

  const pathWithQuery = value.slice(markerIndex + marker.length);
  const [path] = pathWithQuery.split("?");
  return path ? decodeURIComponent(path) : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Unknown error";
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read cropped image"));
    reader.onloadend = () => {
      if (typeof reader.result === "string" && reader.result) {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to encode cropped image"));
    };
    reader.readAsDataURL(blob);
  });
}

async function persistProfilePatch(userId: string, patch: ProfilePatch) {
  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update(patch as never)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (updateError) {
    return { error: updateError };
  }

  if (updatedProfile) {
    return { error: null };
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({
      user_id: userId,
      ...patch,
    } as never);

  return { error: insertError };
}

type UseProfilePageDataResult = {
  user: ReturnType<typeof useAuth>["user"];
  loading: boolean;
  saving: boolean;
  historyCount: number;
  displayName: string;
  draftDisplayName: string;
  profileAvatarUrl: string | null;
  heroImage: string | null;
  history: PlayHistoryEntry[];
  range: StatsRange;
  stats: ListeningStats;
  artistImages: Record<string, string>;
  maxHour: number;
  imageSrc: string | null;
  crop: { x: number; y: number };
  zoom: number;
  isRenameDialogOpen: boolean;
  isCropDialogOpen: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setDraftDisplayName: React.Dispatch<React.SetStateAction<string>>;
  setRange: React.Dispatch<React.SetStateAction<StatsRange>>;
  setCrop: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setIsRenameDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsCropDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saveProfile: () => Promise<void>;
  openImagePicker: () => void;
  handleImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCropComplete: (_croppedArea: Area, nextCroppedAreaPixels: Area) => void;
  showCroppedImage: () => Promise<void>;
  clearCropSource: () => void;
};

export function useProfilePageData(): UseProfilePageDataResult {
  const { user } = useAuth();
  const { scrobblePercent } = useSettings();
  const { getHistory, readCachedHistory } = usePlayHistory();
  const { likedSongs } = useLikedSongs();
  const { favoriteArtists } = useFavoriteArtists();
  const [historyCount, setHistoryCount] = useState(() => readCachedHistory(1000).length);
  const [displayName, setDisplayName] = useState("");
  const [draftDisplayName, setDraftDisplayName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [localHeroImage, setLocalHeroImage] = useState<string | null>(null);
  const [history, setHistory] = useState<PlayHistoryEntry[]>(() => readCachedHistory(1000));
  const [range, setRange] = useState<StatsRange>("30d");
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});
  const parsedScrobblePercent = Number.parseInt(scrobblePercent, 10);
  const normalizedScrobblePercent = Number.isFinite(parsedScrobblePercent)
    ? Math.min(95, Math.max(5, parsedScrobblePercent))
    : 50;

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setHistoryCount(0);
      setLoading(false);
      return;
    }

    const cachedHistory = readCachedHistory(1000);
    if (cachedHistory.length > 0) {
      setHistory(cachedHistory);
      setHistoryCount((current) => Math.max(current, cachedHistory.length));
      setLoading(false);
    } else {
      setLoading(true);
    }

    Promise.all([
      getHistory(1000).then(setHistory),
      supabase
        .from("play_history")
        .select("id", { count: "exact", head: true })
        .then(({ count }) => setHistoryCount(count || 0)),
      supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          const profileData = data as ProfileRecord | null;
          const profileName =
            profileData?.display_name ||
            user.user_metadata?.display_name ||
            user.email?.split("@")[0] ||
            "User";
          setDisplayName(profileName);
          setDraftDisplayName(profileName);
          setProfileAvatarUrl(sanitizePersistedProfileImageUrl(profileData?.avatar_url));
        }),
    ]).finally(() => setLoading(false));
  }, [getHistory, readCachedHistory, user]);

  const filteredHistory = useMemo(
    () => filterHistoryByRange(history, range),
    [history, range],
  );

  const stats = useMemo(
    () => computeListeningStats(filteredHistory, normalizedScrobblePercent),
    [filteredHistory, normalizedScrobblePercent],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchArtistImages = async () => {
      const artistImageEntries = await Promise.all(
        stats.topArtists.map(async ({ artist }) => {
          try {
            const results = await searchArtists(artist, 1);
            const topResult = results[0];
            if (!topResult) {
              return [artist, ""] as const;
            }

            const imageUrl = await resolveArtistImageUrl(
              topResult.id,
              topResult.picture ? getTidalImageUrl(topResult.picture, "750x750") : undefined,
              topResult.name,
            );
            return [artist, imageUrl] as const;
          } catch (error) {
            console.warn(`Failed to fetch image for artist ${artist}:`, error);
            return [artist, ""] as const;
          }
        }),
      );

      const pendingImages = Object.fromEntries(artistImageEntries);

      if (!cancelled) {
        setArtistImages((current) => {
          let changed = false;
          const next = { ...current };
          for (const [artist, imageUrl] of Object.entries(pendingImages)) {
            const currentImageUrl = next[artist];
            if (currentImageUrl !== imageUrl && (imageUrl || currentImageUrl === undefined)) {
              next[artist] = imageUrl;
              changed = true;
            }
          }
          return changed ? next : current;
        });
      }
    };

    if (stats.topArtists.length > 0) {
      void fetchArtistImages();
    }

    return () => {
      cancelled = true;
    };
  }, [stats.topArtists]);

  const saveProfile = useCallback(async () => {
    if (!user) return;
    const nextName = draftDisplayName.trim();
    if (!nextName) {
      toast.error("Display name cannot be empty.");
      return;
    }
    if (nextName === displayName) return;

    setSaving(true);
    const { error } = await persistProfilePatch(user.id, {
      display_name: nextName,
    });
    setSaving(false);

    if (error) {
      toast.error(`Failed to update profile name: ${getErrorMessage(error)}`);
      return;
    }

    setDisplayName(nextName);
    setIsRenameDialogOpen(false);
    toast.success("Profile updated.");
  }, [displayName, draftDisplayName, user]);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    const validationError = validateProfileBannerFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    void (async () => {
      const dimensions = await readImageDimensions(file);
      const dimensionError = validateProfileBannerDimensions(dimensions.width, dimensions.height);
      if (dimensionError) {
        toast.error(dimensionError);
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        toast.error("Failed to read the selected image.");
      };
      reader.onload = (loadEvent) => {
        setImageSrc(loadEvent.target?.result as string);
        setIsCropDialogOpen(true);
      };
      reader.readAsDataURL(file);
    })().catch((error) => {
      console.error("Failed to validate profile banner image", error);
      toast.error("Failed to process the selected image.");
    });
  }, []);

  const onCropComplete = useCallback((_croppedArea: Area, nextCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(nextCroppedAreaPixels);
  }, []);

  const showCroppedImage = useCallback(async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      if (!user) return;

      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      const croppedImageError = validateProfileBannerUploadBlob(croppedImageBlob);
      if (croppedImageError) {
        throw new Error(croppedImageError);
      }
      const localPreviewUrl = URL.createObjectURL(croppedImageBlob);
      const previousStoredPath = getStoredProfileCoverPath(profileAvatarUrl);
      const nextFilePath = `${user.id}/cover-${Date.now()}.jpg`;
      let persistedCoverUrl: string | null = null;

      setLocalHeroImage(localPreviewUrl);

      const { error: uploadError } = await supabase
        .storage
        .from(PROFILE_COVERS_BUCKET)
        .upload(nextFilePath, croppedImageBlob, {
          cacheControl: "3600",
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.warn("Profile cover storage upload failed, falling back to inline image persistence.", uploadError);
        persistedCoverUrl = await blobToDataUrl(croppedImageBlob);
      } else {
        const { data: publicUrlData } = supabase
          .storage
          .from(PROFILE_COVERS_BUCKET)
          .getPublicUrl(nextFilePath);

        persistedCoverUrl = publicUrlData.publicUrl;
      }
      const { error: profileError } = await persistProfilePatch(user.id, {
        avatar_url: persistedCoverUrl,
      });

      if (profileError) {
        if (!uploadError) {
          void supabase.storage.from(PROFILE_COVERS_BUCKET).remove([nextFilePath]);
        }
        URL.revokeObjectURL(localPreviewUrl);
        setLocalHeroImage(null);
        throw profileError;
      }

      if (!uploadError && previousStoredPath && previousStoredPath !== nextFilePath) {
        void supabase.storage.from(PROFILE_COVERS_BUCKET).remove([previousStoredPath]);
      }

      URL.revokeObjectURL(localPreviewUrl);
      setLocalHeroImage(persistedCoverUrl);
      setProfileAvatarUrl(persistedCoverUrl);
      setIsCropDialogOpen(false);
      setImageSrc(null);
      toast.success("Banner image updated.");
    } catch (error) {
      console.error(error);
      toast.error(`Failed to save banner image: ${getErrorMessage(error)}`);
    }
  }, [croppedAreaPixels, imageSrc, profileAvatarUrl, user]);

  const openImagePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearCropSource = useCallback(() => {
    setImageSrc(null);
  }, []);

  useEffect(() => {
    return () => {
      if (localHeroImage?.startsWith("blob:")) {
        URL.revokeObjectURL(localHeroImage);
      }
    };
  }, [localHeroImage]);

  return {
    user,
    loading,
    saving,
    historyCount,
    displayName,
    draftDisplayName,
    profileAvatarUrl,
    heroImage:
      localHeroImage ||
      profileAvatarUrl ||
      favoriteArtists[0]?.artist_image_url ||
      likedSongs[0]?.coverUrl ||
      null,
    history,
    range,
    stats,
    artistImages,
    maxHour: Math.max(...stats.hourCounts, 1),
    imageSrc,
    crop,
    zoom,
    isRenameDialogOpen,
    isCropDialogOpen,
    fileInputRef,
    setDraftDisplayName,
    setRange,
    setCrop,
    setZoom,
    setIsRenameDialogOpen,
    setIsCropDialogOpen,
    saveProfile,
    openImagePicker,
    handleImageUpload,
    onCropComplete,
    showCroppedImage,
    clearCropSource,
  };
}
