import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { albums, playlists, recentlyPlayed, popularAlbums } from "@/data/mockData";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

function HeroSection() {
  const navigate = useNavigate();
  const { play } = usePlayer();
  const featured = albums[0];

  return (
    <div
      className="relative rounded-2xl overflow-hidden h-64 mb-8 cursor-pointer group"
      onClick={() => navigate(`/album/${featured.id}`)}
    >
      <img src={featured.coverUrl} alt={featured.title} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
      <div className="absolute bottom-0 left-0 p-6 flex items-end gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-foreground/70 mb-1">Featured Album</p>
          <h2 className="text-3xl font-bold text-foreground">{featured.title}</h2>
          <p className="text-sm text-foreground/70 mt-1">{featured.artist} · {featured.year}</p>
        </div>
        <Button
          size="icon"
          className="w-12 h-12 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `hsl(var(--dynamic-accent))` }}
          onClick={(e) => {
            e.stopPropagation();
            play(featured.tracks[0], featured.tracks);
          }}
        >
          <Play className="w-5 h-5 text-foreground ml-0.5" />
        </Button>
      </div>
    </div>
  );
}

interface CardRowProps {
  title: string;
  items: { id: string; title: string; artist?: string; description?: string; coverUrl: string; tracks: any[] }[];
  basePath: string;
}

function CardRow({ title, items, basePath }: CardRowProps) {
  const navigate = useNavigate();
  const { play } = usePlayer();

  return (
    <section className="mb-8">
      <h3 className="text-lg font-bold text-foreground mb-4">{title}</h3>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="glass-card p-3 w-44 shrink-0 cursor-pointer group"
            onClick={() => navigate(`${basePath}/${item.id}`)}
          >
            <div className="relative rounded-lg overflow-hidden mb-3 aspect-square">
              <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
              <Button
                size="icon"
                className="absolute bottom-2 right-2 w-10 h-10 rounded-full opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 shadow-lg"
                style={{ background: `hsl(var(--dynamic-accent))` }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.tracks.length > 0) play(item.tracks[0], item.tracks);
                }}
              >
                <Play className="w-4 h-4 text-foreground ml-0.5" />
              </Button>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {item.artist || item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

const Index = () => {
  return (
    <div>
      <HeroSection />
      <CardRow title="Recently Played" items={recentlyPlayed} basePath="/album" />
      <CardRow title="Made For You" items={playlists} basePath="/playlist" />
      <CardRow title="Popular Albums" items={popularAlbums} basePath="/album" />
    </div>
  );
};

export default Index;
