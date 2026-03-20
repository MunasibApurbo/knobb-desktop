import { useState, useEffect } from 'react';

// Global cache to avoid redundant extractions
const colorCache = new Map<string, string>();
// Shared canvas to avoid allocation overhead
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

/**
 * Custom hook to extract the average color from an image.
 * @param imgSrc The source URL of the image.
 * @returns An RGB color string.
 */
export function useImageColor(imgSrc: string | undefined, enabled = true) {
  const [color, setColor] = useState<string>(imgSrc ? (colorCache.get(imgSrc) || 'rgba(255, 255, 255, 0.1)') : 'rgba(255, 255, 255, 0.1)');

  useEffect(() => {
    if (!imgSrc || !enabled) return;
    if (colorCache.has(imgSrc)) {
      setColor(colorCache.get(imgSrc)!);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgSrc;

    img.onload = () => {
      if (!sharedCanvas) {
        sharedCanvas = document.createElement('canvas');
        sharedCanvas.width = 1;
        sharedCanvas.height = 1;
        sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
      }
      
      if (!sharedCtx) return;

      sharedCtx.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = sharedCtx.getImageData(0, 0, 1, 1).data;
      
      // Convert to HSL for better vibrance manipulation
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s, l = (max + min) / 510;

      if (max === min) {
        h = s = 0; // achromatic
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (510 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }

      // Boost saturation significantly for "vibrant" look
      s = Math.min(1, s * 1.5);
      // Ensure it's not too dark or too bright
      l = Math.max(0.3, Math.min(0.7, l));

      const finalColor = `hsla(${h * 360}, ${s * 100}%, ${l * 100}%, 0.85)`;
      colorCache.set(imgSrc, finalColor);
      setColor(finalColor);
    };

    img.onerror = () => {
      console.warn(`Failed to load image for color extraction: ${imgSrc}`);
    };
  }, [enabled, imgSrc]);

  return color;
}
