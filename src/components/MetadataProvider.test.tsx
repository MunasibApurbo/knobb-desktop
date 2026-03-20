import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { MetadataProvider } from "@/components/MetadataProvider";

const metadataProviderMocks = vi.hoisted(() => ({
  player: {
    currentTrack: null as
      | {
          title: string;
          artist?: string;
          artists?: Array<{ name?: string | null }>;
        }
      | null,
    hasPlaybackStarted: false,
    isPlaying: false,
  },
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => metadataProviderMocks.player,
}));

describe("MetadataProvider", () => {
  beforeEach(() => {
    metadataProviderMocks.player.currentTrack = null;
    metadataProviderMocks.player.hasPlaybackStarted = false;
    metadataProviderMocks.player.isPlaying = false;
    document.title = "";
  });

  function renderProvider(initialEntry: string) {
    return render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[initialEntry]}
      >
        <MetadataProvider>
          <div>Metadata test</div>
        </MetadataProvider>
      </MemoryRouter>,
    );
  }

  it("applies the route title when no track is active", async () => {
    renderProvider("/liked");

    await waitFor(() => {
      expect(document.title).toBe("Liked • KNOBB");
    });
  });

  it("overrides the document title with the active track while playing", async () => {
    metadataProviderMocks.player.currentTrack = {
      title: "Midnight City",
      artist: "M83",
      artists: [{ name: "M83" }],
    };
    metadataProviderMocks.player.hasPlaybackStarted = true;
    metadataProviderMocks.player.isPlaying = true;

    renderProvider("/liked");

    await waitFor(() => {
      expect(document.title).toBe("Midnight City - M83 • KNOBB");
    });
  });

  it("restores the route title when a track is loaded but playback is paused", async () => {
    metadataProviderMocks.player.currentTrack = {
      title: "Midnight City",
      artist: "M83",
      artists: [{ name: "M83" }],
    };
    metadataProviderMocks.player.hasPlaybackStarted = true;
    metadataProviderMocks.player.isPlaying = false;

    renderProvider("/settings");

    await waitFor(() => {
      expect(document.title).toBe("Settings • KNOBB");
    });
  });
});
