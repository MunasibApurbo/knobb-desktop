/**
 * Extract dominant color from an image URL using canvas pixel sampling.
 * Returns HSL string like "220 70% 55%"
 */
export async function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 50; // Sample at small size for speed
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("220 70% 55%");
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;

        // Bucket colors and find the most vibrant
        let bestR = 0, bestG = 0, bestB = 0;
        let bestSaturation = 0;

        for (let i = 0; i < imageData.length; i += 16) { // Sample every 4th pixel
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];

          // Skip very dark or very light pixels
          const brightness = (r + g + b) / 3;
          if (brightness < 30 || brightness > 240) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;

          if (saturation > bestSaturation) {
            bestSaturation = saturation;
            bestR = r;
            bestG = g;
            bestB = b;
          }
        }

        resolve(rgbToHsl(bestR, bestG, bestB));
      } catch {
        resolve("220 70% 55%");
      }
    };

    img.onerror = () => resolve("220 70% 55%");
    img.src = imageUrl;
  });
}

function rgbToHsl(r: number, g: number, b: number): string {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
