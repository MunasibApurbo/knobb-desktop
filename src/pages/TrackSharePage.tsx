import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMetadata } from "@/hooks/usePageMetadata";

export default function TrackSharePage() {
  const { trackId } = useParams<{ trackId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const title = searchParams.get("title") || "Track";
  const artist = searchParams.get("artist") || "Unknown artist";
  const album = searchParams.get("album") || "";
  const cover = searchParams.get("cover") || undefined;
  const redirect = searchParams.get("redirect") || "/";

  usePageMetadata({
    title: `${title} - ${artist}`,
    description: album
      ? `Open ${title} by ${artist} from ${album} on Knobb.`
      : `Open ${title} by ${artist} on Knobb.`,
    image: cover,
    imageAlt: `${title} cover art`,
    canonicalPath: `/track/${trackId || ""}`,
    type: "music.song",
  });

  useEffect(() => {
    navigate(redirect, { replace: true });
  }, [navigate, redirect]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090909] p-6 text-white">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-white/60" />
        <h1 className="mt-5 text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 text-lg text-white/70">{artist}</p>
        {album ? <p className="mt-1 text-sm text-white/48">{album}</p> : null}
        <p className="mt-5 text-sm text-white/50">Opening track in Knobb…</p>
        <Button
          variant="ghost"
          className="mt-6 rounded-full border border-white/10 bg-white/[0.04] px-5 text-white hover:bg-white/[0.08]"
          onClick={() => navigate(redirect, { replace: true })}
        >
          Open now
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
