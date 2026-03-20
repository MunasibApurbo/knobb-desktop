import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { usePageMetadata } from "@/hooks/usePageMetadata";
import { APP_HOME_PATH } from "@/lib/routes";

export default function TrackSharePage() {
  const { trackId } = useParams<{ trackId: string }>();
  const [searchParams] = useSearchParams();

  const title = searchParams.get("title") || "Track";
  const artist = searchParams.get("artist") || "Unknown artist";
  const album = searchParams.get("album") || "";
  const cover = searchParams.get("cover") || undefined;
  const redirect = searchParams.get("redirect") || APP_HOME_PATH;

  usePageMetadata({
    title: `${title} | Listen on Knobb`,
    description: album
      ? `Listen to ${title} by ${artist} from ${album} on Knobb. High-quality audio discovery and archives.`
      : `Listen to ${title} by ${artist} on Knobb. High-quality audio discovery and archives.`,
    image: cover,
    imageAlt: `${title} cover art`,
    twitterCard: "summary",
    canonicalPath: `/track/${trackId || ""}`,
    type: "music.song",
  });

  return <Navigate to={redirect} replace />;
}
