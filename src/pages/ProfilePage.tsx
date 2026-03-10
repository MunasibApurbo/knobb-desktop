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
import { UtilityPageLayout, UtilityPagePanel } from "@/components/UtilityPageLayout";
import { useProfilePageData } from "@/hooks/useProfilePageData";
import { PROFILE_BANNER_ACCEPT_ATTRIBUTE } from "@/lib/profileBannerUpload";

export default function ProfilePage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const {
    user,
    loading,
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
  const { scrollY } = useScroll();
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

  if (loading) {
    return (
      <PageTransition>
        <UtilityPageLayout
          eyebrow="Profile"
          title="Your Profile"
          description="Loading your listening identity and recent activity."
        >
          <UtilityPagePanel className="flex min-h-[16rem] items-center justify-center px-4 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
        className="mobile-page-shell w-full space-y-4 pb-4 md:space-y-8 md:pb-12"
      >
        <ProfileHero
          displayName={displayName}
          email={user.email}
          createdAt={user.created_at}
          heroImage={heroImage}
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

        <div className="w-full">
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
