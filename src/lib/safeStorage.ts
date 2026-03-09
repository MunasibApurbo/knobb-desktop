type StorageKey = string;

type StorageValue = string;

const memoryStorage = new Map<StorageKey, StorageValue>();

function getBrowserStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeStorageGetItem(key: StorageKey) {
  const storage = getBrowserStorage();
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      // Fall through to in-memory storage.
    }
  }

  return memoryStorage.get(key) ?? null;
}

export function safeStorageSetItem(key: StorageKey, value: StorageValue) {
  const storage = getBrowserStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
      return;
    } catch {
      // Fall through to in-memory storage.
    }
  }

  memoryStorage.set(key, value);
}

export function safeStorageRemoveItem(key: StorageKey) {
  const storage = getBrowserStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore removal failures and still clear in-memory state.
    }
  }

  memoryStorage.delete(key);
}

export function safeStorageClear() {
  const storage = getBrowserStorage();
  if (storage) {
    try {
      storage.clear();
    } catch {
      // Ignore clear failures and still clear in-memory state.
    }
  }

  memoryStorage.clear();
}

export const safeSupabaseStorage = {
  getItem: (key: StorageKey) => safeStorageGetItem(key),
  setItem: (key: StorageKey, value: StorageValue) => safeStorageSetItem(key, value),
  removeItem: (key: StorageKey) => safeStorageRemoveItem(key),
};
