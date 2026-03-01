import { Home, Search, Library, Heart, Music, ListMusic } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { playlists } from "@/data/mockData";
import { ScrollArea } from "@/components/ui/scroll-area";

const mainNav = [
  { title: "Home", url: "/", icon: Home },
  { title: "Search", url: "/search", icon: Search },
  { title: "Library", url: "/library", icon: Library },
  { title: "Liked Songs", url: "/liked", icon: Heart },
];

export function AppSidebar() {
  return (
    <aside className="w-60 shrink-0 h-full flex flex-col glass-heavy rounded-xl m-2 mr-0 overflow-hidden">
      {/* Logo */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Music className="w-7 h-7 text-foreground" />
        <span className="text-lg font-bold tracking-tight text-foreground">Harmonia</span>
      </div>

      {/* Main Nav */}
      <nav className="px-3 space-y-0.5">
        {mainNav.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            activeClassName="text-foreground bg-accent/60"
          >
            <item.icon className="w-5 h-5" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-5 my-3 h-px bg-border/50" />

      {/* Playlists */}
      <div className="px-5 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Playlists</span>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-0.5 pb-4">
          {playlists.map((pl) => (
            <NavLink
              key={pl.id}
              to={`/playlist/${pl.id}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              activeClassName="text-foreground bg-accent/60"
            >
              <ListMusic className="w-4 h-4 shrink-0" />
              <span className="truncate">{pl.title}</span>
            </NavLink>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
