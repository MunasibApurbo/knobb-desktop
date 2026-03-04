import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayHistory } from "@/hooks/usePlayHistory";
import { getArtistTopTracks, TidalTrack } from "@/lib/monochromeApi";
import { Track } from "@/types/music";

export function useRecommendations() {
    const { user } = useAuth();
    const { getHistory } = usePlayHistory();
    const [recommendations, setRecommendations] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setRecommendations([]);
            setLoading(false);
            return;
        }

        const fetchRecommendations = async () => {
            setLoading(true);
            try {
                // 1. Get recent listening history
                const history = await getHistory(100);

                if (history.length === 0) {
                    setRecommendations([]);
                    setLoading(false);
                    return;
                }

                // 2. Count top artists
                const artistCounts: Record<string, { id: number, name: string, count: number }> = {};
                for (const track of history) {
                    if (track.artistId) {
                        if (!artistCounts[track.artistId]) {
                            artistCounts[track.artistId] = { id: track.artistId, name: track.artist, count: 0 };
                        }
                        artistCounts[track.artistId].count++;
                    }
                }

                // 3. Get top 3 artists
                const topArtists = Object.values(artistCounts)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3);

                if (topArtists.length === 0) {
                    setRecommendations([]);
                    setLoading(false);
                    return;
                }

                // 4. Fetch top tracks from those artists via Monochrome API
                const artistTrackPromises = topArtists.map(artist => getArtistTopTracks(artist.id, 10));
                const results = await Promise.all(artistTrackPromises);

                // 5. Interleave the tracks to create a diverse playlist
                const interleaved: TidalTrack[] = [];
                const maxLen = Math.max(...results.map(arr => arr.length));

                for (let i = 0; i < maxLen; i++) {
                    for (const artistTracks of results) {
                        if (i < artistTracks.length) interleaved.push(artistTracks[i]);
                    }
                }

                // 6. Map to local Track interface and filter out tracks the user *just* played
                const historyIds = new Set(history.slice(0, 20).map(t => t.id));

                const convertedTracks: Track[] = interleaved
                    .filter(t => !historyIds.has(String(t.id))) // Don't recommend songs they played today
                    .slice(0, 20) // Keep it to top 20 fresh recs
                    .map(t => ({
                        id: String(t.id),
                        title: t.title,
                        artist: t.artist.name,
                        artistId: t.artist.id,
                        album: t.album.title,
                        albumId: t.album.id,
                        coverUrl: t.album.cover,
                        duration: t.duration,
                        streamUrl: "",
                        tidalId: t.id
                    }));

                setRecommendations(convertedTracks);
            } catch (error) {
                console.error("Failed to fetch recommendations:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [user, getHistory]);

    return { recommendations, loading };
}
