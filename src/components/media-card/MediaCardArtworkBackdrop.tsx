import { cn } from "@/lib/utils";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";

type MediaCardArtworkBackdropProps = {
  artworkUrl: string;
  className?: string;
  imageClassName?: string;
  isPriority?: boolean;
  overlayClassName?: string;
};

const DEFAULT_OVERLAY_CLASS =
  "absolute inset-0 bg-gradient-to-b from-white/6 via-black/8 to-black/26";

export function MediaCardArtworkBackdrop({
  artworkUrl,
  className,
  imageClassName,
  isPriority = false,
  overlayClassName = DEFAULT_OVERLAY_CLASS,
}: MediaCardArtworkBackdropProps) {
  const { allowHeavyBlur, lowEndDevice, strongDesktopEffects } = useMotionPreferences();
  const shouldRenderArtworkWash =
    Boolean(artworkUrl) &&
    isPriority &&
    !lowEndDevice &&
    strongDesktopEffects &&
    allowHeavyBlur;

  return (
    <div className={cn("media-card-artwork-backdrop absolute inset-0 -z-10 overflow-hidden", className)} aria-hidden="true">
      {shouldRenderArtworkWash ? (
        <div className="shell-artwork-wash">
          <img
            src={artworkUrl}
            alt=""
            loading="eager"
            decoding="async"
            className={imageClassName}
          />
        </div>
      ) : null}
      <div className={overlayClassName} />
    </div>
  );
}
