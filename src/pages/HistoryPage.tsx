import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { Track } from "@/types/music";
import { formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Clock, Play, Trash2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function HistoryPage() {
  const { play } = usePlayer();
  const { user } = useAuth();
  const { getHistory, clearHistory } = usePlayHistory();
  const navigate = useNavigate();
  const [history, setHistory] = useState<(Track & { playedAt: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getHistory(100).then(setHistory).finally(() => setLoading(false));
  }, [user, getHistory]);

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recently Played</h1>
          <p className="text-sm text-muted-foreground mt-1">{history.length} tracks</p>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={async () => {
            await clearHistory();
            setHistory([]);
          }}>
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {!user ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground text-sm">Sign in to see your play history.</p>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No history yet. Start playing some tracks!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {history.map((track, i) => (
            <button
              key={`${track.id}-${i}`}
              className="flex items-center gap-4 w-full px-3 py-2.5  hover:bg-accent/15 transition-colors text-left group"
              onClick={() => play(track)}
            >
              <img src={track.coverUrl} alt="" className="w-11 h-11 object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">{track.title}</p>
                <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(track.playedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-sm text-muted-foreground font-mono w-10 text-right">{formatDuration(track.duration)}</span>
              <Play className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
