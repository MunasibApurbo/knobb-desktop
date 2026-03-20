import { describe, expect, it } from "vitest";
import type { TidalTrack } from "@/lib/musicApiTypes";
import { getLyricsFallbackCandidateIds } from "@/lib/musicLyricsVariants";

function makeTrack(overrides: Partial<TidalTrack> = {}): TidalTrack {
  return {
    id: 1,
    title: "Real Life",
    duration: 207,
    artist: { id: 8821167, name: "The Marias", picture: null },
    artists: [{ id: 8821167, name: "The Marias", type: "MAIN" }],
    album: {
      id: 365065428,
      title: "Submarine",
      cover: "cover-id",
      vibrantColor: null,
    },
    version: null,
    popularity: 70,
    explicit: false,
    audioQuality: "LOSSLESS",
    replayGain: 0,
    peak: 1,
    ...overrides,
  };
}

describe("getLyricsFallbackCandidateIds", () => {
  it("prefers higher-quality sibling editions of the same song", () => {
    const base = makeTrack({
      id: 359734951,
      album: { id: 359734944, title: "Submarine", cover: "atmos-cover", vibrantColor: null },
      audioQuality: "LOW",
    });
    const stereo = makeTrack({
      id: 365065444,
      audioQuality: "LOSSLESS",
    });
    const unrelated = makeTrack({
      id: 77704201,
      artist: { id: 4761957, name: "The Weeknd", picture: null },
      artists: [{ id: 4761957, name: "The Weeknd", type: "MAIN" }],
      album: { id: 77704192, title: "Beauty Behind the Madness", cover: "weeknd-cover", vibrantColor: null },
    });

    expect(getLyricsFallbackCandidateIds(base, [unrelated, stereo])).toEqual([365065444]);
  });

  it("rejects mismatched durations and duplicate ids", () => {
    const base = makeTrack();
    const duplicate = makeTrack({ id: 1, audioQuality: "HIGH" });
    const liveVersion = makeTrack({ id: 2, duration: 260, version: "Live" });
    const closeMatch = makeTrack({ id: 3, duration: 205, audioQuality: "HIGH" });

    expect(getLyricsFallbackCandidateIds(base, [duplicate, liveVersion, closeMatch])).toEqual([3]);
  });

  it("keeps non-Latin titles and artists matchable for lyric fallbacks", () => {
    const base = makeTrack({
      id: 10,
      title: "আমার সোনার বাংলা",
      artist: { id: 5001, name: "অর্ণব", picture: null },
      artists: [{ id: 5001, name: "অর্ণব", type: "MAIN" }],
      album: {
        id: 9001,
        title: "গানের খাতা",
        cover: "bangla-cover",
        vibrantColor: null,
      },
      audioQuality: "LOW",
    });
    const stereo = makeTrack({
      id: 11,
      title: "আমার সোনার বাংলা",
      artist: { id: 5001, name: "অর্ণব", picture: null },
      artists: [{ id: 5001, name: "অর্ণব", type: "MAIN" }],
      album: {
        id: 9001,
        title: "গানের খাতা",
        cover: "bangla-cover",
        vibrantColor: null,
      },
      audioQuality: "LOSSLESS",
    });
    const unrelated = makeTrack({
      id: 12,
      title: "ভুল গান",
      artist: { id: 5002, name: "অন্য শিল্পী", picture: null },
      artists: [{ id: 5002, name: "অন্য শিল্পী", type: "MAIN" }],
      album: {
        id: 9002,
        title: "অন্য অ্যালবাম",
        cover: "other-cover",
        vibrantColor: null,
      },
      audioQuality: "HI_RES_LOSSLESS",
    });

    expect(getLyricsFallbackCandidateIds(base, [unrelated, stereo])).toEqual([11]);
  });
});
