import { render } from "@testing-library/react";
import { createRef } from "react";

import { useSmoothScroll } from "@/hooks/useSmoothScroll";

const lenisMocks = vi.hoisted(() => {
  const destroy = vi.fn();
  const resize = vi.fn();
  const scrollTo = vi.fn();
  const raf = vi.fn();
  const constructor = vi.fn(() => ({
    destroy,
    resize,
    scrollTo,
    raf,
  }));

  return {
    constructor,
    destroy,
    resize,
    scrollTo,
    raf,
  };
});

vi.mock("lenis", () => ({
  default: lenisMocks.constructor,
}));

function SmoothScrollProbe({ enabled = true }: { enabled?: boolean }) {
  const wrapperRef = createRef<HTMLDivElement>();
  const contentRef = createRef<HTMLElement>();

  useSmoothScroll({
    enabled,
    wrapperRef,
    contentRef,
    lerp: 0.12,
    startDelay: 50,
    wheelMultiplier: 0.7,
  });

  return (
    <div ref={wrapperRef} data-main-scroll-viewport="true" data-testid="viewport">
      <main ref={contentRef}>content</main>
    </div>
  );
}

describe("useSmoothScroll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lenisMocks.constructor.mockClear();
    lenisMocks.destroy.mockClear();
    lenisMocks.resize.mockClear();
    lenisMocks.scrollTo.mockClear();
    lenisMocks.raf.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("starts Lenis for the main viewport after the configured delay", () => {
    let rafCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return 1;
    });

    render(<SmoothScrollProbe />);

    expect(lenisMocks.constructor).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);

    expect(lenisMocks.constructor).toHaveBeenCalledWith(expect.objectContaining({
      wrapper: expect.any(HTMLDivElement),
      content: expect.any(HTMLElement),
      eventsTarget: expect.any(HTMLDivElement),
      lerp: 0.12,
      wheelMultiplier: 0.7,
      smoothWheel: true,
    }));
    expect(lenisMocks.resize).toHaveBeenCalled();
    rafCallback?.(16);
    expect(lenisMocks.raf).toHaveBeenCalledWith(16);

    requestAnimationFrameSpy.mockRestore();
  });

  it("does not create Lenis while disabled", () => {
    render(<SmoothScrollProbe enabled={false} />);

    vi.advanceTimersByTime(50);

    expect(lenisMocks.constructor).not.toHaveBeenCalled();
  });
});
