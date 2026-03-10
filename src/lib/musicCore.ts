import { APICache } from "@/lib/musicCoreCache";
import { InstanceStore } from "@/lib/musicCoreInstances";
import {
  API_INSTANCE_POOL,
  buildInstanceUrl,
  delay,
  EndpointLatencySnapshot,
  FetchWithRetryOptions,
  getPercentile,
  InstanceDescriptor,
  InstanceType,
  LATENCY_SAMPLE_SIZE,
  SourceAlbum,
  SourceArtist,
  SourceArtistPage,
  SourcePlaylist,
  SourceTrack,
  SourceTrackLookup,
  STREAMING_INSTANCE_POOL,
} from "@/lib/musicCoreShared";
import {
  getArtist as loadArtistPage,
  getArtistBiography as loadArtistBiography,
  getArtistMetadata as loadArtistMetadata,
  getArtistTopTracks as loadArtistTopTracks,
  getSimilarArtists as loadSimilarArtists,
  type ArtistPageOptions,
} from "@/lib/musicCoreArtists";
import {
  getAlbum as loadAlbum,
  getPlaylist as loadPlaylist,
  getSimilarAlbums as loadSimilarAlbums,
} from "@/lib/musicCoreCollections";
import {
  searchAlbums as loadAlbumSearch,
  searchArtists as loadArtistSearch,
  searchPlaylists as loadPlaylistSearch,
  searchTracks as loadTrackSearch,
} from "@/lib/musicCoreSearch";
import {
  getStreamUrl as resolveStreamUrl,
  getTrack as loadTrackLookup,
  getTrackMetadata as loadTrackMetadata,
  getTrackRecommendations as loadTrackRecommendations,
} from "@/lib/musicCoreTracks";

export type {
  EndpointLatencySnapshot,
  SourceAlbum,
  SourceArtist,
  SourceArtistPage,
  SourcePlaylist,
  SourceTrack,
  SourceTrackLookup,
};

export {
  API_INSTANCE_POOL,
  STREAMING_INSTANCE_POOL,
};

class MusicCoreClient {
  private readonly cache = new APICache({ maxSize: 240, ttl: 1000 * 60 * 30 });
  private readonly instanceStore = new InstanceStore();
  private readonly streamCache = new Map<string, string>();
  private readonly latencySamples = new Map<string, number[]>();
  private readonly jsonResponseCache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly inFlightJsonRequests = new Map<string, Promise<unknown>>();

  constructor() {
    if (typeof window !== "undefined") {
      window.setInterval(() => {
        this.cache.clearExpired();
        this.pruneStreamCache();
      }, 1000 * 60 * 5);
    }
  }

  getLatencySnapshot(): EndpointLatencySnapshot[] {
    return Array.from(this.latencySamples.entries())
      .map(([endpoint, samples]) => ({
        endpoint,
        sampleCount: samples.length,
        p95Ms: Math.round(getPercentile(samples, 95)),
        avgMs: Math.round(
          samples.reduce((sum, item) => sum + item, 0) / Math.max(samples.length, 1),
        ),
      }))
      .sort((a, b) => b.p95Ms - a.p95Ms);
  }

  clearCaches() {
    this.streamCache.clear();
    this.jsonResponseCache.clear();
    this.inFlightJsonRequests.clear();
    void this.cache.clear();
    void this.instanceStore.clearCache();
  }

  invalidateTrackStream(trackId: number) {
    const prefix = `${trackId}:`;
    for (const key of Array.from(this.streamCache.keys())) {
      if (key.startsWith(prefix)) {
        this.streamCache.delete(key);
      }
    }
  }

  async requestJson(relativePath: string, options: FetchWithRetryOptions = {}) {
    const requestKey = JSON.stringify([
      options.type || "api",
      options.minVersion || null,
      relativePath,
    ]);
    const now = Date.now();
    const freshTtlMs = 1000 * 30;
    const staleTtlMs = 1000 * 60 * 5;
    const cached = this.jsonResponseCache.get(requestKey);
    const clonePayload = <T,>(value: T): T => {
      if (typeof structuredClone === "function") {
        return structuredClone(value);
      }
      return JSON.parse(JSON.stringify(value)) as T;
    };

    if (cached && now - cached.timestamp < freshTtlMs) {
      return clonePayload(cached.data);
    }

    const performRequest = async () => {
      try {
        const response = await this.fetchWithRetry(relativePath, options);
        const data = await response.json();
        this.jsonResponseCache.set(requestKey, { data, timestamp: Date.now() });
        return data;
      } catch (error) {
        if (cached && now - cached.timestamp < staleTtlMs) {
          return cached.data;
        }
        throw error;
      } finally {
        this.inFlightJsonRequests.delete(requestKey);
      }
    };

    if (cached && now - cached.timestamp < staleTtlMs && !this.inFlightJsonRequests.has(requestKey)) {
      const backgroundRefresh = performRequest().catch(() => undefined);
      this.inFlightJsonRequests.set(requestKey, backgroundRefresh);
      return clonePayload(cached.data);
    }

    const inFlight = this.inFlightJsonRequests.get(requestKey);
    if (inFlight) {
      return inFlight.then((value) => clonePayload(value));
    }

    const requestPromise = performRequest();

    this.inFlightJsonRequests.set(requestKey, requestPromise);
    return requestPromise.then((value) => clonePayload(value));
  }

  async searchTracks(query: string, limit = 25) {
    return loadTrackSearch(
      {
        cache: this.cache,
        requestJson: (relativePath) => this.requestJson(relativePath),
      },
      query,
      limit,
    );
  }

  async searchArtists(query: string, limit = 20) {
    return loadArtistSearch(
      {
        cache: this.cache,
        requestJson: (relativePath) => this.requestJson(relativePath),
      },
      query,
      limit,
    );
  }

  async searchAlbums(query: string, limit = 20) {
    return loadAlbumSearch(
      {
        cache: this.cache,
        requestJson: (relativePath) => this.requestJson(relativePath),
      },
      query,
      limit,
    );
  }

  async searchPlaylists(query: string, limit = 20) {
    return loadPlaylistSearch(
      {
        cache: this.cache,
        requestJson: (relativePath) => this.requestJson(relativePath),
      },
      query,
      limit,
    );
  }

  async getArtistMetadata(artistId: number) {
    return loadArtistMetadata(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
        searchAlbums: (query, limit) => this.searchAlbums(query, limit),
        getArtist: (id, options) => this.getArtist(id, options),
        getArtistTopTracks: (id, limit) => this.getArtistTopTracks(id, limit),
      },
      artistId,
    );
  }

  async getArtistTopTracks(artistId: number, limit = 20) {
    return loadArtistTopTracks(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
        searchAlbums: (query, pageLimit) => this.searchAlbums(query, pageLimit),
        getArtist: (id, options) => this.getArtist(id, options),
        getArtistTopTracks: (id, pageLimit) => this.getArtistTopTracks(id, pageLimit),
      },
      artistId,
      limit,
    );
  }

  async getArtist(artistId: number, options: ArtistPageOptions = {}) {
    return loadArtistPage(
      {
        cache: this.cache,
        requestJson: (relativePath, requestOptions) =>
          this.requestJson(relativePath, requestOptions),
        searchAlbums: (query, limit) => this.searchAlbums(query, limit),
        getArtist: (id, artistOptions) => this.getArtist(id, artistOptions),
        getArtistTopTracks: (id, limit) => this.getArtistTopTracks(id, limit),
      },
      artistId,
      options,
    );
  }

  async getAlbum(albumId: number) {
    return loadAlbum(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
      },
      albumId,
    );
  }

  async getPlaylist(playlistId: string) {
    return loadPlaylist(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
      },
      playlistId,
    );
  }

  async getSimilarArtists(artistId: number) {
    return loadSimilarArtists(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
        searchAlbums: (query, limit) => this.searchAlbums(query, limit),
        getArtist: (id, options) => this.getArtist(id, options),
        getArtistTopTracks: (id, limit) => this.getArtistTopTracks(id, limit),
      },
      artistId,
    );
  }

  async getArtistBiography(artistId: number) {
    return loadArtistBiography(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
        searchAlbums: (query, limit) => this.searchAlbums(query, limit),
        getArtist: (id, options) => this.getArtist(id, options),
        getArtistTopTracks: (id, limit) => this.getArtistTopTracks(id, limit),
      },
      artistId,
    );
  }

  async getSimilarAlbums(albumId: number) {
    return loadSimilarAlbums(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
      },
      albumId,
    );
  }

  async getTrackMetadata(trackId: number) {
    return loadTrackMetadata(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
        streamCache: this.streamCache,
        getTrack: (id, quality) => this.getTrack(id, quality),
      },
      trackId,
    );
  }

  async getTrackRecommendations(trackId: number) {
    return loadTrackRecommendations(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
        streamCache: this.streamCache,
        getTrack: (id, quality) => this.getTrack(id, quality),
      },
      trackId,
    );
  }

  async getTrack(trackId: number, quality = "HI_RES_LOSSLESS") {
    return loadTrackLookup(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
        streamCache: this.streamCache,
        getTrack: (id, nextQuality) => this.getTrack(id, nextQuality),
      },
      trackId,
      quality,
    );
  }

  async getStreamUrl(trackId: number, quality = "HI_RES_LOSSLESS") {
    return resolveStreamUrl(
      {
        cache: this.cache,
        requestJson: (relativePath, options) => this.requestJson(relativePath, options),
        streamCache: this.streamCache,
        getTrack: (id, nextQuality) => this.getTrack(id, nextQuality),
      },
      trackId,
      quality,
    );
  }

  private async attemptInstanceRequest(
    instance: InstanceDescriptor,
    relativePath: string,
    type: InstanceType,
    signal?: AbortSignal,
  ) {
    const targetUrl = buildInstanceUrl(instance.url, relativePath);
    const startedAt = performance.now();
    const response = await fetch(targetUrl, { signal });

    if (response.status === 401) {
      const cloned = response.clone();
      try {
        const payload = await cloned.json();
        if (payload?.subStatus === 11002) {
          throw new Error(`${instance.url} authentication failed`);
        }
      } catch {
        // Ignore malformed auth payloads.
      }
    }

    if (!response.ok) {
      throw new Error(`${instance.url} responded with ${response.status}`);
    }

    this.recordLatency(relativePath, performance.now() - startedAt);
    this.instanceStore.recordWinner(type, instance.url);
    return response;
  }

  private async fetchWithRetry(relativePath: string, options: FetchWithRetryOptions = {}) {
    const type = options.type || "api";
    let instances = await this.instanceStore.getInstances(type);
    if (instances.length === 0) {
      throw new Error(`No API instances configured for type: ${type}`);
    }

    if (options.minVersion) {
      instances = instances.filter((instance) => {
        if (!instance.version) return false;
        return (
          Number.parseFloat(instance.version) >=
          Number.parseFloat(options.minVersion as string)
        );
      });
      if (instances.length === 0) {
        throw new Error(
          `No instances available for ${type} with minVersion ${options.minVersion}`,
        );
      }
    }

    const errors: string[] = [];
    const topTier = instances.slice(0, Math.min(3, instances.length));
    const remaining = instances.slice(topTier.length);

    const attempt = async (instance: InstanceDescriptor) => {
      try {
        return await this.attemptInstanceRequest(instance, relativePath, type, options.signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        errors.push(error instanceof Error ? error.message : String(error));
        throw error;
      }
    };

    if (topTier.length === 1) {
      try {
        return await attempt(topTier[0]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
      }
    } else if (topTier.length > 1) {
      try {
        return await Promise.any(topTier.map((instance) => attempt(instance)));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
      }
    }

    for (const instance of remaining) {
      try {
        return await attempt(instance);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        await delay(120);
      }
    }

    throw new Error(
      errors.length > 0
        ? `All instances failed for ${relativePath}: ${errors.join(" | ")}`
        : `All instances failed for ${relativePath}`,
    );
  }

  private pruneStreamCache() {
    if (this.streamCache.size <= 50) return;
    const overflow = this.streamCache.size - 50;
    const keys = Array.from(this.streamCache.keys()).slice(0, overflow);
    keys.forEach((key) => this.streamCache.delete(key));

    if (this.jsonResponseCache.size > 120) {
      const oldestKeys = Array.from(this.jsonResponseCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, this.jsonResponseCache.size - 120)
        .map(([key]) => key);

      oldestKeys.forEach((key) => this.jsonResponseCache.delete(key));
    }
  }

  private recordLatency(relativePath: string, durationMs: number) {
    const endpoint =
      relativePath.replace(/\?.*$/, "").replace(/^\/+|\/+$/g, "") || "root";
    const existing = this.latencySamples.get(endpoint) || [];
    existing.push(durationMs);
    if (existing.length > LATENCY_SAMPLE_SIZE) {
      existing.shift();
    }
    this.latencySamples.set(endpoint, existing);
  }
}

export const musicCore = new MusicCoreClient();
