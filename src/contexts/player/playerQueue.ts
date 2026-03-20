import { Track } from "@/types/music";

export function getQueueTrackIndex(queue: Track[], track: Track | null) {
  if (!track) return -1;
  return queue.findIndex((item) => item.id === track.id);
}

export function getNextQueueIndex(
  queue: Track[],
  currentTrack: Track | null,
  shuffle: boolean,
  options: { wrap?: boolean } = {},
) {
  const { wrap = false } = options;
  if (queue.length === 0 || !currentTrack) return null;
  if (shuffle) {
    return Math.floor(Math.random() * queue.length);
  }

  const currentIndex = getQueueTrackIndex(queue, currentTrack);
  if (currentIndex < 0) return 0;
  if (currentIndex >= queue.length - 1) {
    return wrap ? 0 : null;
  }
  return currentIndex + 1;
}

export function getPreviousQueueIndex(
  queue: Track[],
  currentTrack: Track | null,
  options: { wrap?: boolean } = {},
) {
  const { wrap = false } = options;
  if (queue.length === 0 || !currentTrack) return null;
  const currentIndex = getQueueTrackIndex(queue, currentTrack);
  if (currentIndex < 0) return wrap ? queue.length - 1 : null;
  if (currentIndex === 0) return wrap ? queue.length - 1 : null;
  return currentIndex - 1;
}

export function reorderQueueTracks(queue: Track[], from: number, to: number) {
  const nextQueue = [...queue];
  const [moved] = nextQueue.splice(from, 1);
  if (!moved) return queue;
  nextQueue.splice(to, 0, moved);
  return nextQueue;
}

export function removeQueueTrack(queue: Track[], index: number) {
  return queue.filter((_, itemIndex) => itemIndex !== index);
}
