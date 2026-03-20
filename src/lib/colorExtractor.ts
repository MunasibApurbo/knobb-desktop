/**
 * Extract dominant color from an image URL using canvas pixel sampling.
 * Returns HSL string like "220 70% 55%" when available.
 */
const SAMPLE_SIZE = 50;
const PIXEL_STRIDE = 16;
const MIN_BRIGHTNESS = 18;
const MAX_BRIGHTNESS = 242;

type HslComponents = {
  h: number;
  s: number;
  l: number;
};

type BucketStats = {
  count: number;
  score: number;
  sumR: number;
  sumG: number;
  sumB: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rgbToHslComponents(r: number, g: number, b: number): HslComponents {
  const normalizedR = r / 255;
  const normalizedG = g / 255;
  const normalizedB = b / 255;

  const max = Math.max(normalizedR, normalizedG, normalizedB);
  const min = Math.min(normalizedR, normalizedG, normalizedB);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case normalizedR:
        h = ((normalizedG - normalizedB) / d + (normalizedG < normalizedB ? 6 : 0)) / 6;
        break;
      case normalizedG:
        h = ((normalizedB - normalizedR) / d + 2) / 6;
        break;
      default:
        h = ((normalizedR - normalizedG) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s, l };
}

function toPresentationHsl(r: number, g: number, b: number): string {
  const { h, s, l } = rgbToHslComponents(r, g, b);
  const saturation = Math.round(s * 100);
  const lightness = Math.round(l * 100);

  if (saturation < 14) {
    return `${Math.round(h)} ${Math.max(saturation, 8)}% ${clamp(lightness + 10, 58, 74)}%`;
  }

  return `${Math.round(h)} ${clamp(saturation, 22, 76)}% ${clamp(lightness, 42, 68)}%`;
}

function buildBucketKey(h: number, s: number, l: number) {
  const hueBucket = s < 0.12 ? 0 : Math.round(h / 24);
  const satBucket = Math.round(s * 8);
  const lightBucket = Math.round(l * 6);
  return `${hueBucket}:${satBucket}:${lightBucket}`;
}

export function pickDominantColorFromPixelData(imageData: Uint8ClampedArray): string | null {
  const buckets = new Map<string, BucketStats>();
  let fallbackWeight = 0;
  let fallbackR = 0;
  let fallbackG = 0;
  let fallbackB = 0;

  for (let i = 0; i < imageData.length; i += PIXEL_STRIDE) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const alpha = imageData[i + 3];

    if (alpha < 24) continue;

    const brightness = (r + g + b) / 3;
    if (brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS) continue;

    const { h, s, l } = rgbToHslComponents(r, g, b);
    const key = buildBucketKey(h, s, l);
    const lightnessBalance = 1 - Math.min(1, Math.abs(l - 0.56) / 0.56);
    const pixelScore = 1 + s * 0.8 + lightnessBalance * 0.35;
    const existing = buckets.get(key);

    if (existing) {
      existing.count += 1;
      existing.score += pixelScore;
      existing.sumR += r;
      existing.sumG += g;
      existing.sumB += b;
    } else {
      buckets.set(key, {
        count: 1,
        score: pixelScore,
        sumR: r,
        sumG: g,
        sumB: b,
      });
    }

    const fallbackPixelWeight = 1 + lightnessBalance * 0.5;
    fallbackWeight += fallbackPixelWeight;
    fallbackR += r * fallbackPixelWeight;
    fallbackG += g * fallbackPixelWeight;
    fallbackB += b * fallbackPixelWeight;
  }

  let bestBucket: BucketStats | null = null;
  for (const bucket of buckets.values()) {
    if (!bestBucket || bucket.score > bestBucket.score) {
      bestBucket = bucket;
    }
  }

  if (bestBucket) {
    return toPresentationHsl(
      Math.round(bestBucket.sumR / bestBucket.count),
      Math.round(bestBucket.sumG / bestBucket.count),
      Math.round(bestBucket.sumB / bestBucket.count),
    );
  }

  if (fallbackWeight <= 0) {
    return null;
  }

  return toPresentationHsl(
    Math.round(fallbackR / fallbackWeight),
    Math.round(fallbackG / fallbackWeight),
    Math.round(fallbackB / fallbackWeight),
  );
}

export async function extractDominantColor(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        resolve(pickDominantColorFromPixelData(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data));
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

export function extractDominantColorFromMediaElement(
  mediaElement: HTMLImageElement | HTMLVideoElement,
): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    const sourceWidth = mediaElement instanceof HTMLVideoElement ? mediaElement.videoWidth : mediaElement.naturalWidth;
    const sourceHeight = mediaElement instanceof HTMLVideoElement ? mediaElement.videoHeight : mediaElement.naturalHeight;
    if (!sourceWidth || !sourceHeight) {
      return null;
    }

    ctx.drawImage(mediaElement, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return pickDominantColorFromPixelData(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
  } catch {
    return null;
  }
}
