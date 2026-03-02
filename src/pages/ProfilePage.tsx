import { useAuth } from "@/contexts/AuthContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { User, Music, Heart, ListMusic, Clock, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Track } from "@/data/mockData";
import { supabase } from "@/integrations/supabase/client";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { getHistory } = usePlayHistory();
  const { playlists } = usePlaylists();
  const { likedSongs } = useLikedSongs();
  const navigate = useNavigate();
  const [historyCount, setHistoryCount] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    
    Promise.all([
      getHistory(500).then((h) => setHistoryCount(h.length)),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setDisplayName(data?.display_name || user.email?.split("@")[0] || "User");
        }),
    ]).finally(() => setLoading(false));
  }, [user, getHistory]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <User className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Sign in to view your profile.</p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Profile header */}
      <div className="glass-heavy rounded-xl p-6 flex items-center gap-5">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
          style={{ backgroundColor: `hsl(var(--dynamic-accent) / 0.2)`, color: `hsl(var(--dynamic-accent))` }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{displayName}</h1>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Member since {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Music, label: "Tracks Played", value: historyCount },
          { icon: Heart, label: "Liked Songs", value: likedSongs.length },
          { icon: ListMusic, label: "Playlists", value: playlists.length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-heavy rounded-xl p-4 text-center space-y-1">
            <Icon className="w-5 h-5 mx-auto text-muted-foreground" />
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="glass-heavy rounded-xl p-5 space-y-2">
        <button onClick={() => navigate("/settings")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-accent/15 transition-colors text-left text-sm text-foreground">
          <Clock className="w-4 h-4 text-muted-foreground" /> Settings & Preferences
        </button>
        <button onClick={() => navigate("/stats")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-accent/15 transition-colors text-left text-sm text-foreground">
          <Music className="w-4 h-4 text-muted-foreground" /> Listening Stats
        </button>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md hover:bg-accent/15 transition-colors text-left text-sm text-destructive"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}
