import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SeekSurface } from "@/components/player/SeekSurface";

describe("SeekSurface", () => {
  it("commits keyboard seeks immediately", () => {
    const onSeek = vi.fn();

    render(
      <SeekSurface
        ariaLabel="Seek playback position"
        currentTime={30}
        duration={100}
        onSeek={onSeek}
      >
        <div>progress</div>
      </SeekSurface>,
    );

    const seekbar = screen.getByRole("slider", { name: /seek playback position/i });
    fireEvent.keyDown(seekbar, { key: "ArrowRight" });

    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek).toHaveBeenCalledWith(35);
  });
});
