import {
  API_INSTANCE_POOL,
  API_PRIORITY_STORAGE_KEY,
  fetchJsonWithTimeout,
  INSTANCE_CACHE_TTL_MS,
  INSTANCE_STORAGE_KEY,
  InstanceDescriptor,
  InstanceType,
  normalizeOrigin,
  storageGet,
  storageSet,
  STREAMING_INSTANCE_POOL,
  STREAMING_PRIORITY_STORAGE_KEY,
  UPTIME_URLS,
} from "@/lib/musicCoreShared";

function mergeWithFallbackInstances(
  instances: InstanceDescriptor[],
  fallbackUrls: readonly string[],
  fallbackVersion = "2.4",
) {
  const merged = new Map<string, InstanceDescriptor>();

  for (const instance of instances) {
    const normalizedUrl = normalizeOrigin(instance.url) || instance.url;
    if (!normalizedUrl) continue;
    merged.set(normalizedUrl, {
      url: normalizedUrl,
      version: instance.version,
    });
  }

  for (const url of fallbackUrls) {
    if (!merged.has(url)) {
      merged.set(url, { url, version: fallbackVersion });
    }
  }

  return Array.from(merged.values());
}

export class InstanceStore {
  private loadPromise: Promise<Record<InstanceType, InstanceDescriptor[]>> | null = null;
  private currentInstances: Record<InstanceType, InstanceDescriptor[]> = this.normalizePayload(null);

  async getInstances(type: InstanceType) {
    const loaded = await this.loadInstances();
    const priorityKey = type === "streaming" ? STREAMING_PRIORITY_STORAGE_KEY : API_PRIORITY_STORAGE_KEY;
    const fallbackUrls = type === "streaming" ? [...STREAMING_INSTANCE_POOL] : [...API_INSTANCE_POOL];
    const prioritized = this.getPrioritizedUrls(priorityKey, fallbackUrls);
    const resolved = loaded[type].map((instance) => ({
      ...instance,
      url: normalizeOrigin(instance.url) || instance.url,
    }));
    const byUrl = new Map(resolved.map((instance) => [instance.url, instance]));

    const ordered = prioritized
      .map((url) => byUrl.get(url))
      .filter((instance): instance is InstanceDescriptor => Boolean(instance));
    const remaining = resolved.filter((instance) => !ordered.some((candidate) => candidate.url === instance.url));

    return [...ordered, ...remaining];
  }

  recordWinner(type: InstanceType, url: string) {
    const priorityKey = type === "streaming" ? STREAMING_PRIORITY_STORAGE_KEY : API_PRIORITY_STORAGE_KEY;
    const fallbackUrls = type === "streaming" ? [...STREAMING_INSTANCE_POOL] : [...API_INSTANCE_POOL];
    const normalized = normalizeOrigin(url);
    if (!normalized) return;

    const current = this.getPrioritizedUrls(priorityKey, fallbackUrls);
    const next = [normalized, ...current.filter((item) => item !== normalized)].slice(0, 15);
    storageSet(priorityKey, JSON.stringify(next));
  }

  async clearCache() {
    this.loadPromise = null;
    this.currentInstances = this.normalizePayload(null);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(INSTANCE_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  private getPrioritizedUrls(storageKey: string, fallback: string[]) {
    const stored = storageGet(storageKey);
    if (!stored) return fallback;

    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return fallback;
      const normalized = parsed
        .map((item) => (typeof item === "string" ? normalizeOrigin(item) : null))
        .filter((item): item is string => Boolean(item));
      const preferred = normalized.filter((item) => fallback.includes(item));
      const remaining = fallback.filter((item) => !preferred.includes(item));
      return [...preferred, ...remaining];
    } catch {
      return fallback;
    }
  }

  private async loadInstances() {
    const cached = this.readCachedInstances();
    if (cached) {
      this.currentInstances = cached.data;
      if (Date.now() - cached.timestamp < INSTANCE_CACHE_TTL_MS) {
        return this.currentInstances;
      }
    }

    if (!this.loadPromise) {
      this.loadPromise = this.refreshInstancesFromUptime()
        .catch(() => this.currentInstances)
        .finally(() => {
          this.loadPromise = null;
        });
    }

    return this.currentInstances;
  }

  private async refreshInstancesFromUptime() {
    const urls = [...UPTIME_URLS].sort(() => Math.random() - 0.5);

    try {
      const payload = await Promise.any(
        urls.map(async (url) => {
          const response = await fetchJsonWithTimeout(url, 2500);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.json();
        }),
      );

      const data = this.normalizePayload(payload);
      this.currentInstances = data;
      storageSet(INSTANCE_STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
      return data;
    } catch {
      return this.currentInstances;
    }
  }

  private readCachedInstances() {
    const raw = storageGet(INSTANCE_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const data = this.normalizePayload((parsed as { data?: unknown }).data);
      const timestamp = Number((parsed as { timestamp?: unknown }).timestamp) || 0;
      return { timestamp, data };
    } catch {
      return null;
    }
  }

  private normalizePayload(payload: unknown): Record<InstanceType, InstanceDescriptor[]> {
    if (
      payload &&
      typeof payload === "object" &&
      "api" in payload &&
      Array.isArray((payload as { api?: unknown[] }).api)
    ) {
      const raw = payload as { api: InstanceDescriptor[]; streaming?: InstanceDescriptor[] };
      const api = raw.api
        .filter((instance) => !String(instance?.url || "").includes("spotisaver.net"))
        .map((instance) => ({
          url: normalizeOrigin(instance.url) || instance.url,
          version: instance.version,
        }));

      const streamingSource = Array.isArray(raw.streaming) ? raw.streaming : api;
      const streaming = streamingSource
        .filter((instance) => !String(instance?.url || "").includes("spotisaver.net"))
        .map((instance) => ({
          url: normalizeOrigin(instance.url) || instance.url,
          version: instance.version,
        }));

      return {
        api: mergeWithFallbackInstances(api, API_INSTANCE_POOL),
        streaming: mergeWithFallbackInstances(streaming, STREAMING_INSTANCE_POOL),
      };
    }

    return {
      api: API_INSTANCE_POOL.map((url, index) => ({ url, version: index < 4 ? "2.4" : "2.3" })),
      streaming: STREAMING_INSTANCE_POOL.map((url) => ({ url, version: "2.4" })),
    };
  }
}
