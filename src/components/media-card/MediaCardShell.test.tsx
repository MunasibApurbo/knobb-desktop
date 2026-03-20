import { fireEvent, render, screen } from "@testing-library/react";

import { MediaCardShell } from "./MediaCardShell";

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: true,
    cardHoverProfile: null,
    lowEndDevice: false,
    strongDesktopEffects: false,
    websiteMode: "roundish",
  }),
}));

vi.mock("@/lib/motion", () => ({
  getStaggerItemVariants: () => undefined,
}));

describe("MediaCardShell", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-main-scrolling");
  });

  it("suppresses hover work while the main viewport is scrolling", () => {
    const handleMouseEnter = vi.fn();

    render(
      <MediaCardShell data-testid="card" onClick={() => undefined} onMouseEnter={handleMouseEnter}>
        <div>Card</div>
      </MediaCardShell>,
    );

    const card = screen.getByTestId("card");
    document.documentElement.setAttribute("data-main-scrolling", "true");

    fireEvent.mouseEnter(card);
    fireEvent.pointerEnter(card);
    fireEvent.pointerMove(card);

    expect(handleMouseEnter).not.toHaveBeenCalled();
  });

  it("runs hover work once scrolling has stopped", () => {
    const handleMouseEnter = vi.fn();

    render(
      <MediaCardShell data-testid="card" onClick={() => undefined} onMouseEnter={handleMouseEnter}>
        <div>Card</div>
      </MediaCardShell>,
    );

    const card = screen.getByTestId("card");

    fireEvent.mouseEnter(card);

    expect(handleMouseEnter).toHaveBeenCalledTimes(1);
  });
});
