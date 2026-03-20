import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PageTransition } from "@/components/PageTransition";
import { motion } from "framer-motion";
import { usePlayer } from "@/contexts/PlayerContext";
import { ProfileCropDialog } from "@/components/profile/ProfileCropDialog";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileRenameDialog } from "@/components/profile/ProfileRenameDialog";
import { ProfileStatsSection } from "@/components/profile/ProfileStatsSection";
import { UtilityPageLayout, UtilityPagePanel } from "@/components/UtilityPageLayout";
import { useProfilePageData } from "@/hooks/useProfilePageData";
import { PROFILE_BANNER_ACCEPT_ATTRIBUTE } from "@/lib/profileBannerUpload";

export default function ProfilePage() {
  const navigate = useNavigate();
  const {
    user,
    saving,
    displayName,
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
  const { play } = usePlayer();
  const resolvedDisplayName = displayName || user.user_metadata?.display_name || user.email?.split("@")[0] || "User";
  const topTracksQueue = stats.topTracks.map(({ track }) => track);
  if (!user) {
    return (
      <PageTransition>
        <UtilityPageLayout
          eyebrow="Profile"
          title="Your Profile"
          description="Your listening identity, stats, and account personalization live here."
        >
          <UtilityPagePanel className="flex flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
            <User className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-6 text-muted-foreground">Sign in to view your profile.</p>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </UtilityPagePanel>
        </UtilityPageLayout>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="page-shell w-full space-y-4 pb-4 md:space-y-8 md:pb-12"
      >
        <ProfileHero
          displayName={resolvedDisplayName}
          email={user.email}
          createdAt={user.created_at}
          heroImage={heroImage}
          onEditDisplayName={() => {
            setDraftDisplayName(resolvedDisplayName);
            setIsRenameDialogOpen(true);
          }}
          onChangeCoverImage={openImagePicker}
        />

        <div className="w-full">
          <ProfileStatsSection
            range={range}
            stats={stats}
            maxHour={maxHour}
            artistImages={artistImages}
            onRangeChange={setRange}
            onArtistSelect={(artist) => navigate(`/artist/search?name=${encodeURIComponent(artist)}`)}
            onTrackSelect={(track) => {
              play(track, topTracksQueue);
            }}
          />
        </div>
      </motion.div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept={PROFILE_BANNER_ACCEPT_ATTRIBUTE}
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
