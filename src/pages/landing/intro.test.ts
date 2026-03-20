import { playLandingTransition } from "@/pages/landing/intro";

describe("playLandingTransition", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("hides the transition immediately on low-end devices", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div class="transition">
        <div class="transition-overlay overlay-1"></div>
        <div class="transition-logo-container"></div>
      </div>
    `;
    document.body.appendChild(container);

    playLandingTransition(container, { lowEndDevice: true });

    const transition = container.querySelector<HTMLElement>(".transition");
    expect(transition?.dataset.transitionState).toBe("done");
    expect(transition?.style.display).toBe("none");
  });
});
