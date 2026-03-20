import { useRef } from "react";
import { act, render, screen } from "@testing-library/react";

import { useMainScrollY } from "@/hooks/useMainScrollY";

function ScrollProbe({ enabled = true, step }: { enabled?: boolean; step?: number }) {
  const scrollY = useMainScrollY(enabled, step);

  return (
    <>
      <div data-main-scroll-viewport="true" />
      <output data-testid="scroll-y">{scrollY}</output>
    </>
  );
}

function SharedScrollProbe() {
  const firstScrollY = useMainScrollY();
  const secondScrollY = useMainScrollY();

  return (
    <>
      <div data-main-scroll-viewport="true" />
      <output data-testid="scroll-y-first">{firstScrollY}</output>
      <output data-testid="scroll-y-second">{secondScrollY}</output>
    </>
  );
}

function ScrollRenderProbe() {
  const scrollY = useMainScrollY(true, 8);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  return (
    <>
      <div data-main-scroll-viewport="true" />
      <output data-testid="scroll-y">{scrollY}</output>
      <output data-testid="render-count">{renderCountRef.current}</output>
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
    render(<ScrollProbe step={1} />);

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

    expect(screen.getByTestId("scroll-y")).toHaveTextContent("180");
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
    render(<ScrollRenderProbe />);

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
    expect(screen.getByTestId("render-count")).toHaveTextContent("1");
  });

  it("uses a coarser default step to avoid rerendering large pages on small scroll deltas", () => {
    render(<ScrollProbe />);

    act(() => {
      flushAnimationFrames();
    });

    const viewport = document.querySelector<HTMLElement>("[data-main-scroll-viewport='true']");
    expect(viewport).not.toBeNull();

    act(() => {
      if (!viewport) return;
      viewport.scrollTop = 47;
      viewport.dispatchEvent(new Event("scroll"));
      flushAnimationFrames();
    });

    expect(screen.getByTestId("scroll-y")).toHaveTextContent("0");

    act(() => {
      if (!viewport) return;
      viewport.scrollTop = 96;
      viewport.dispatchEvent(new Event("scroll"));
      flushAnimationFrames();
    });

    expect(screen.getByTestId("scroll-y")).toHaveTextContent("96");
  });

  it("shares one viewport subscription across multiple consumers", () => {
    const addEventListenerSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");

    render(<SharedScrollProbe />);

    act(() => {
      flushAnimationFrames();
    });

    const viewport = document.querySelector<HTMLElement>("[data-main-scroll-viewport='true']");
    expect(viewport).not.toBeNull();

    const scrollSubscriptions = addEventListenerSpy.mock.calls.filter(
      ([eventName, , options]) =>
        eventName === "scroll" &&
        typeof options === "object" &&
        options !== null &&
        "passive" in options &&
        options.passive === true,
    );
    expect(scrollSubscriptions).toHaveLength(1);

    act(() => {
      if (!viewport) return;
      viewport.scrollTop = 96;
      viewport.dispatchEvent(new Event("scroll"));
      flushAnimationFrames();
    });

    expect(screen.getByTestId("scroll-y-first")).toHaveTextContent("96");
    expect(screen.getByTestId("scroll-y-second")).toHaveTextContent("96");

    addEventListenerSpy.mockRestore();
  });
});
