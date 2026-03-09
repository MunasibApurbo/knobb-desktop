function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function extractPayload<T = unknown>(value: unknown): T {
  if (isRecord(value) && "data" in value) {
    return ((value as { data?: T }).data ?? value) as T;
  }
  return value as T;
}

function unwrapItem(value: unknown) {
  if (isRecord(value) && "item" in value) {
    return (value as { item?: unknown }).item ?? value;
  }
  return value;
}

function getArrayProp(value: unknown, key: string) {
  if (!isRecord(value)) return [];
  const candidate = value[key];
  return Array.isArray(candidate) ? candidate : [];
}

function getObjectProp<T extends object>(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const candidate = value[key];
  return isRecord(candidate) ? (candidate as T) : null;
}

function getFirstArrayEntry(value: unknown) {
  return Array.isArray(value) && value.length > 0 ? value[0] : null;
}

export {
  extractPayload,
  getArrayProp,
  getFirstArrayEntry,
  getObjectProp,
  isRecord,
  unwrapItem,
};
