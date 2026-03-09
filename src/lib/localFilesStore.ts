import type { Track } from "@/types/music";

const DB_NAME = "knobb-local-files";
const DB_VERSION = 1;
const STORE_NAME = "tracks";

type LocalFileTrackRecord = {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  track: Omit<Track, "streamUrl">;
};

function isSupportedAudioFile(file: File) {
  if (file.type.startsWith("audio/")) return true;
  return /\.(mp3|m4a|flac|wav|ogg|opus|aac|mp4|webm)$/i.test(file.name);
}

function createLocalFileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function parseTrackName(fileName: string) {
  const normalized = stripExtension(fileName).replace(/[_]+/g, " ").trim();
  const split = normalized.split(/\s+-\s+/);

  if (split.length >= 2) {
    return {
      artist: split[0].trim() || "Local File",
      title: split.slice(1).join(" - ").trim() || normalized || "Untitled",
    };
  }

  return {
    artist: "Local File",
    title: normalized || "Untitled",
  };
}

function hashHue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return hash;
}

async function readDuration(file: File) {
  if (typeof Audio === "undefined" || typeof URL === "undefined") return 0;

  const objectUrl = URL.createObjectURL(file);

  try {
    const duration = await new Promise<number>((resolve) => {
      const audio = new Audio();
      let settled = false;

      const finish = (value: number) => {
        if (settled) return;
        settled = true;
        audio.src = "";
        resolve(Number.isFinite(value) && value > 0 ? value : 0);
      };

      const timeoutId = window.setTimeout(() => finish(0), 4000);

      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        window.clearTimeout(timeoutId);
        finish(audio.duration);
      };
      audio.onerror = () => {
        window.clearTimeout(timeoutId);
        finish(0);
      };
      audio.src = objectUrl;
    });

    return Math.round(duration);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function buildTrackRecord(file: File): Promise<LocalFileTrackRecord> {
  const id = createLocalFileId();
  const createdAt = new Date().toISOString();
  const parsed = parseTrackName(file.name);
  const duration = await readDuration(file);
  const fallbackYear = new Date(file.lastModified || Date.now()).getFullYear();

  return {
    id,
    blob: file,
    fileName: file.name,
    mimeType: file.type || "audio/*",
    size: file.size,
    createdAt,
    track: {
      id: `local-${id}`,
      localFileId: id,
      isLocal: true,
      localFileSize: file.size,
      localImportedAt: createdAt,
      title: parsed.title,
      artist: parsed.artist,
      album: "Local Files",
      duration,
      year: Number.isFinite(fallbackYear) ? fallbackYear : new Date().getFullYear(),
      coverUrl: "/placeholder.svg",
      canvasColor: `${hashHue(file.name)} 64% 52%`,
    },
  };
}

class LocalFilesStore {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase | null> | null = null;

  private async open() {
    if (typeof indexedDB === "undefined") return null;

    return new Promise<IDBDatabase | null>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
    });
  }

  private async getDb() {
    if (!this.dbReady) {
      this.dbReady = this.open();
    }

    if (!this.db) {
      await this.dbReady.catch(() => null);
    }

    return this.db;
  }

  async list() {
    const db = await this.getDb();
    if (!db) return [] as LocalFileTrackRecord[];

    return new Promise<LocalFileTrackRecord[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const records = Array.isArray(request.result) ? request.result as LocalFileTrackRecord[] : [];
        resolve(records.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addFiles(files: File[]) {
    const supportedFiles = files.filter(isSupportedAudioFile);
    if (supportedFiles.length === 0) return 0;

    const records: LocalFileTrackRecord[] = [];
    for (const file of supportedFiles) {
      records.push(await buildTrackRecord(file));
    }

    const db = await this.getDb();
    if (!db) throw new Error("IndexedDB is unavailable in this browser.");

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      for (const record of records) {
        store.put(record);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });

    return records.length;
  }

  async remove(id: string) {
    const db = await this.getDb();
    if (!db) return;

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    const db = await this.getDb();
    if (!db) return;

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const localFilesStore = new LocalFilesStore();
export type { LocalFileTrackRecord };
