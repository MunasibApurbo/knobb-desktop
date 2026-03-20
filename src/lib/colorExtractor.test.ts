import { describe, expect, it } from "vitest";

import { pickDominantColorFromPixelData } from "@/lib/colorExtractor";

function parseHslToken(token: string) {
  const match = token.match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) {
    throw new Error(`Invalid HSL token: ${token}`);
  }

  return {
    hue: Number(match[1]),
    saturation: Number(match[2]),
    lightness: Number(match[3]),
  };
}

function makePixelData(sampledColors: Array<[number, number, number, number]>) {
  const pixels: number[] = [];

  for (const color of sampledColors) {
    for (let i = 0; i < 4; i += 1) {
      pixels.push(...color);
    }
  }

  return new Uint8ClampedArray(pixels);
}

describe("pickDominantColorFromPixelData", () => {
  it("prefers the recurring artwork tone over a stray saturated pixel", () => {
    const token = pickDominantColorFromPixelData(makePixelData([
      ...Array.from({ length: 18 }, () => [176, 129, 118, 255] as [number, number, number, number]),
      ...Array.from({ length: 2 }, () => [24, 92, 222, 255] as [number, number, number, number]),
    ]));

    expect(token).not.toBeNull();

    const { hue, saturation } = parseHslToken(token!);
    expect(hue).toBeGreaterThanOrEqual(5);
    expect(hue).toBeLessThanOrEqual(35);
    expect(saturation).toBeGreaterThanOrEqual(20);
    expect(saturation).toBeLessThanOrEqual(45);
  });

  it("returns a polished neutral when the art is mostly grayscale", () => {
    const token = pickDominantColorFromPixelData(makePixelData([
      ...Array.from({ length: 12 }, () => [122, 122, 122, 255] as [number, number, number, number]),
      ...Array.from({ length: 8 }, () => [164, 164, 164, 255] as [number, number, number, number]),
    ]));

    expect(token).not.toBeNull();

    const { saturation, lightness } = parseHslToken(token!);
    expect(saturation).toBeLessThanOrEqual(14);
    expect(lightness).toBeGreaterThanOrEqual(58);
    expect(lightness).toBeLessThanOrEqual(74);
  });
});
