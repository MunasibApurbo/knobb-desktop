import { PageTransition } from "@/components/PageTransition";
import { ArtistGridDirectoryView } from "@/components/artistgrid/ArtistGridDirectoryView";
import { useArtistGridDirectory } from "@/hooks/useArtistGridDirectory";

export default function ArtistGridPage() {
  const { artists, error, loaded, sortedArtists } = useArtistGridDirectory();

  return (
    <PageTransition>
      <div className="page-shell hover-desaturate-page">
        <ArtistGridDirectoryView
          artists={artists}
          sortedArtists={sortedArtists}
          loaded={loaded}
          error={error}
          showBackButton
        />
      </div>
    </PageTransition>
  );
}
