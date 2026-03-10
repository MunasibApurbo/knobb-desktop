import { act, render, screen } from "@testing-library/react";

import { useMainScrollY } from "@/hooks/useMainScrollY";

function ScrollProbe({ enabled = true }: { enabled?: boolean }) {
  const scrollY = useMainScrollY(enabled);

  return (
    <>
      <div data-main-scroll-viewport="true" />
      <output data-testid="scroll-y">{scrollY}</output>
    </>
  );
}

describe("useMainScrollY", () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  let animationFrameId = 0;
  let queuedFrames = new Map<number, FrameRequestCallback>();

  const flushAnimationFrames = () => {
    const pendingFrames = Array.from(queuedFrames.entries());
    queuedFrames = new Map();

    for (const [id, callback] of pendingFrames) {
      callback(id);
    }
  };

  beforeEach(() => {
    animationFrameId = 0;
    queuedFrames = new Map();

    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      animationFrameId += 1;
      queuedFrames.set(animationFrameId, callback);
      return animationFrameId;
    });
    window.cancelAnimationFrame = vi.fn((id: number) => {
      queuedFrames.delete(id);
    });
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("tracks the main scroll viewport position", () => {
    render(<ScrollProbe />);

    act(() => {
      flushAnimationFrames();
    });

    const viewport = document.querySelector<HTMLElement>("[data-main-scroll-viewport='true']");
    expect(viewport).not.toBeNull();

    act(() => {
      if (!viewport) return;
      viewport.scrollTop = 180;
      viewport.dispatchEvent(new Event("scroll"));
      flushAnimationFrames();
    });

    expect(screen.getByTestId("scroll-y")).toHaveTextContent("184");
  });

  it("stays at zero when tracking is disabled", () => {
    render(<ScrollProbe enabled={false} />);

    const viewport = document.querySelector<HTMLElement>("[data-main-scroll-viewport='true']");
    expect(viewport).not.toBeNull();

    act(() => {
      if (!viewport) return;
      viewport.scrollTop = 240;
      viewport.dispatchEvent(new Event("scroll"));
    });

    expect(screen.getByTestId("scroll-y")).toHaveTextContent("0");
  });

  it("ignores sub-step scroll deltas to avoid excessive rerenders", () => {
    render(<ScrollProbe />);

    act(() => {
      flushAnimationFrames();
    });

    const viewport = document.querySelector<HTMLElement>("[data-main-scroll-viewport='true']");
    expect(viewport).not.toBeNull();

    act(() => {
      if (!viewport) return;
      viewport.scrollTop = 3;
      viewport.dispatchEvent(new Event("scroll"));
      flushAnimationFrames();
    });

    expect(screen.getByTestId("scroll-y")).toHaveTextContent("0");
  });
});
