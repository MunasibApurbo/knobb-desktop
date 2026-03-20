const MEDIA_UNLOCK_DATA_URI = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

let mediaPlaybackPrimed = false;
let mediaPlaybackPrimePromise: Promise<void> | null = null;

function createPrimerElement(tagName: "audio" | "video") {
  const element = document.createElement(tagName) as HTMLMediaElement & { playsInline?: boolean };
  element.preload = "auto";
  element.volume = 0;
  element.muted = true;
  element.src = MEDIA_UNLOCK_DATA_URI;

  if (tagName === "video") {
    element.playsInline = true;
  }

  return element;
}

function cleanupPrimerElement(element: HTMLMediaElement) {
  try {
    element.pause();
  } catch {
    // Ignore cleanup failures for detached primer elements.
  }

  element.removeAttribute("src");
  try {
    element.load();
  } catch {
    // Ignore detached element reset failures.
  }
}

export function primeMediaPlayback() {
  if (mediaPlaybackPrimed) {
    return Promise.resolve();
  }

  if (mediaPlaybackPrimePromise) {
    return mediaPlaybackPrimePromise;
  }

  if (typeof document === "undefined") {
    mediaPlaybackPrimed = true;
    return Promise.resolve();
  }

  const primerElements = [
    createPrimerElement("audio"),
    createPrimerElement("video"),
  ];

  mediaPlaybackPrimePromise = Promise.allSettled(
    primerElements.map((element) => element.play()),
  )
    .then((results) => {
      mediaPlaybackPrimed = results.some((result) => result.status === "fulfilled");
      if (!mediaPlaybackPrimed) {
        mediaPlaybackPrimePromise = null;
      }
    })
    .finally(() => {
      primerElements.forEach(cleanupPrimerElement);
    });

  return mediaPlaybackPrimePromise;
}

export function __resetMediaPlaybackPrimerForTests() {
  mediaPlaybackPrimed = false;
  mediaPlaybackPrimePromise = null;
}
