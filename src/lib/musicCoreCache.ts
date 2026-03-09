import { CacheRecord } from "@/lib/musicCoreShared";

export class APICache {
  private memoryCache = new Map<string, CacheRecord>();
  private readonly maxSize: number;
  private readonly ttl: number;
  private readonly dbName: string;
  private readonly dbVersion: number;
  private db: IDBDatabase | null = null;
  private readonly dbReady: Promise<IDBDatabase | null>;

  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.maxSize = options.maxSize ?? 200;
    this.ttl = options.ttl ?? 1000 * 60 * 30;
    this.dbName = "nobbb-music-cache";
    this.dbVersion = 1;
    this.dbReady = this.initDB();
  }

  private async initDB() {
    if (typeof indexedDB === "undefined") return null;

    return new Promise<IDBDatabase | null>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("responses")) {
          const store = db.createObjectStore("responses", { keyPath: "key" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  private generateKey(type: string, params: unknown) {
    const paramString = typeof params === "object" ? JSON.stringify(params) : String(params);
    return `${type}:${paramString}`;
  }

  async get<T>(type: string, params: unknown): Promise<T | null> {
    const key = this.generateKey(type, params);

    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (Date.now() - memoryEntry.timestamp < this.ttl) {
        return memoryEntry.data as T;
      }
      this.memoryCache.delete(key);
    }

    if (!this.db) {
      await this.dbReady.catch(() => null);
    }
    if (!this.db) return null;

    try {
      const dbEntry = await this.getFromIndexedDB(key);
      if (dbEntry && Date.now() - dbEntry.timestamp < this.ttl) {
        this.memoryCache.set(key, dbEntry);
        return dbEntry.data as T;
      }
    } catch {
      // Ignore IndexedDB errors.
    }

    return null;
  }

  async set(type: string, params: unknown, data: unknown) {
    const key = this.generateKey(type, params);
    const entry: CacheRecord = { key, data, timestamp: Date.now() };
    this.memoryCache.set(key, entry);

    if (this.memoryCache.size > this.maxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }

    if (!this.db) {
      await this.dbReady.catch(() => null);
    }
    if (!this.db) return;

    try {
      await this.setInIndexedDB(entry);
    } catch {
      // Ignore IndexedDB errors.
    }
  }

  async clear() {
    this.memoryCache.clear();

    if (!this.db) {
      await this.dbReady.catch(() => null);
    }
    if (!this.db) return;

    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(["responses"], "readwrite");
      const store = transaction.objectStore("responses");
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }).catch(() => undefined);
  }

  clearExpired() {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp >= this.ttl) {
        this.memoryCache.delete(key);
      }
    }

    if (!this.db || typeof IDBKeyRange === "undefined") return;

    try {
      const transaction = this.db.transaction(["responses"], "readwrite");
      const store = transaction.objectStore("responses");
      const index = store.index("timestamp");
      const range = IDBKeyRange.upperBound(now - this.ttl);
      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    } catch {
      // Ignore IndexedDB errors.
    }
  }

  private getFromIndexedDB(key: string) {
    return new Promise<CacheRecord | null>((resolve, reject) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      const transaction = this.db.transaction(["responses"], "readonly");
      const store = transaction.objectStore("responses");
      const request = store.get(key);
      request.onsuccess = () => resolve((request.result as CacheRecord | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private setInIndexedDB(entry: CacheRecord) {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction(["responses"], "readwrite");
      const store = transaction.objectStore("responses");
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
