import { Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { motion, useScroll } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileCropDialog } from "@/components/profile/ProfileCropDialog";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileRenameDialog } from "@/components/profile/ProfileRenameDialog";
import { ProfileStatsSection } from "@/components/profile/ProfileStatsSection";
import { useProfilePageData } from "@/hooks/useProfilePageData";

export default function ProfilePage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const {
    user,
    loading,
    saving,
    displayName,
    profileCompleteness,
    profileCompletenessLabel,
    draftDisplayName,
    heroImage,
    range,
    stats,
    artistImages,
    maxHour,
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
  } = useProfilePageData();
  const { scrollY } = useScroll();
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

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="pb-32 w-full h-full">
        <ProfileHero
          displayName={displayName}
          email={user.email}
          createdAt={user.created_at}
          heroImage={heroImage}
          profileCompleteness={profileCompleteness}
          profileCompletenessLabel={profileCompletenessLabel}
          scrollY={scrollY}
          onEditDisplayName={() => {
            setDraftDisplayName(displayName);
            setIsRenameDialogOpen(true);
          }}
          onChangeCoverImage={openImagePicker}
          onSignOut={() => {
            void (async () => {
              await signOut();
              navigate("/auth");
            })();
          }}
        />

        <div className="w-full pb-10">
          <ProfileStatsSection
            range={range}
            stats={stats}
            maxHour={maxHour}
            artistImages={artistImages}
            onRangeChange={setRange}
            onArtistSelect={(artist) => navigate(`/artist/search?name=${encodeURIComponent(artist)}`)}
            onTrackSelect={(track) => navigate(`/album/tidal-${track.albumId}?title=${encodeURIComponent(track.album || "")}&artist=${encodeURIComponent(track.artist || "")}`)}
          />
        </div>
      </motion.div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      <ProfileRenameDialog
        open={isRenameDialogOpen}
        saving={saving}
        value={draftDisplayName}
        currentValue={displayName}
        onOpenChange={setIsRenameDialogOpen}
        onValueChange={setDraftDisplayName}
        onSave={() => {
          void saveProfile();
        }}
      />

      <ProfileCropDialog
        open={isCropDialogOpen}
        imageSrc={imageSrc}
        crop={crop}
        zoom={zoom}
        onOpenChange={setIsCropDialogOpen}
        onCropChange={setCrop}
        onCropComplete={onCropComplete}
        onZoomChange={setZoom}
        onSave={() => {
          void showCroppedImage();
        }}
        onClose={() => {
          setIsCropDialogOpen(false);
          clearCropSource();
        }}
      />
    </PageTransition>
  );
}
