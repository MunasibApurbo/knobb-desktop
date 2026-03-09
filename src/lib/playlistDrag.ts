import type { Track } from "@/types/music";

const PLAYLIST_DRAG_MIME = "application/x-knobb-playlist-transfer";
const PLAYLIST_DRAG_FALLBACK_MIME = "text/x-knobb-playlist-transfer";
const MAX_STORED_PAYLOADS = 24;

type PlaylistDragSource = "track" | "album" | "playlist" | "selection";

export interface PlaylistDragPayload {
  label: string;
  source: PlaylistDragSource;
  sourcePlaylistId?: string;
  tracks: Track[];
}

type StoredDragEntry = {
  pending?: Promise<PlaylistDragPayload | null>;
  payload?: PlaylistDragPayload | null;
};

const payloadStore = new Map<string, StoredDragEntry>();
let activeDragId: string | null = null;

function pruneStoredPayloads() {
  while (payloadStore.size > MAX_STORED_PAYLOADS) {
    const oldestKey = payloadStore.keys().next().value;
    if (!oldestKey) break;
    payloadStore.delete(oldestKey);
  }
}

export function getPlaylistDragSummary(payload: PlaylistDragPayload) {
  const count = payload.tracks.length;
  const noun = count === 1 ? "track" : "tracks";
  return `${payload.label} (${count} ${noun})`;
}

function setDragTransferData(dataTransfer: DataTransfer | null, label: string) {
  if (!dataTransfer) return;
  dataTransfer.effectAllowed = "copyMove";
  dataTransfer.setData("text/plain", label);
}

export function startPlaylistDrag(
  dataTransfer: DataTransfer | null,
  payload: PlaylistDragPayload,
) {
  if (!dataTransfer || payload.tracks.length === 0) return null;

  const dragId = crypto.randomUUID();
  payloadStore.set(dragId, { payload });
  pruneStoredPayloads();
  activeDragId = dragId;

  setDragTransferData(dataTransfer, getPlaylistDragSummary(payload));
  if (!dataTransfer) return dragId;
  dataTransfer.setData(PLAYLIST_DRAG_MIME, dragId);
  dataTransfer.setData(PLAYLIST_DRAG_FALLBACK_MIME, dragId);

  return dragId;
}

export function startDeferredPlaylistDrag(
  dataTransfer: DataTransfer | null,
  label: string,
  loadPayload: () => Promise<PlaylistDragPayload | null>,
) {
  const dragId = crypto.randomUUID();
  const pending = Promise.resolve(loadPayload())
    .then((payload) => {
      const entry = payloadStore.get(dragId);
      if (!entry) return payload;
      entry.payload = payload;
      entry.pending = undefined;
      return payload;
    })
    .catch(() => {
      payloadStore.delete(dragId);
      return null;
    });

  payloadStore.set(dragId, { pending, payload: null });
  pruneStoredPayloads();
  activeDragId = dragId;

  setDragTransferData(dataTransfer, label);
  if (!dataTransfer) return dragId;
  dataTransfer.setData(PLAYLIST_DRAG_MIME, dragId);
  dataTransfer.setData(PLAYLIST_DRAG_FALLBACK_MIME, dragId);

  return dragId;
}

export function hasPlaylistDragPayload(dataTransfer: DataTransfer | null) {
  if (activeDragId && payloadStore.has(activeDragId)) return true;
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types).some(
    (type) => type === PLAYLIST_DRAG_MIME || type === PLAYLIST_DRAG_FALLBACK_MIME,
  );
}

export async function consumePlaylistDrag(dataTransfer: DataTransfer | null) {
  const dragIdFromTransfer = dataTransfer
    ? dataTransfer.getData(PLAYLIST_DRAG_MIME) || dataTransfer.getData(PLAYLIST_DRAG_FALLBACK_MIME)
    : "";
  const dragId = dragIdFromTransfer || activeDragId;
  if (!dragId) return null;

  const entry = payloadStore.get(dragId);
  const payload = entry?.pending ? await entry.pending : (entry?.payload ?? null);
  payloadStore.delete(dragId);
  if (activeDragId === dragId) activeDragId = null;

  return payload;
}

export function clearActivePlaylistDrag() {
  if (!activeDragId) return;
  payloadStore.delete(activeDragId);
  activeDragId = null;
}
