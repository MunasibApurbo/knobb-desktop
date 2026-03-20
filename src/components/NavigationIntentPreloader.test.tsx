import { fireEvent, render, screen } from "@testing-library/react";
import { NavigationIntentPreloader } from "@/components/NavigationIntentPreloader";

const navigationIntentMocks = vi.hoisted(() => ({
  preloadHrefRoute: vi.fn(),
  readStartupPerformanceBudget: vi.fn(() => ({
    canPreloadLikelyRoutes: true,
  })),
}));

vi.mock("@/lib/performanceProfile", () => ({
  readStartupPerformanceBudget: () => navigationIntentMocks.readStartupPerformanceBudget(),
}));

vi.mock("@/lib/routePreload", () => ({
  preloadHrefRoute: (...args: unknown[]) => navigationIntentMocks.preloadHrefRoute(...args),
}));

describe("NavigationIntentPreloader", () => {
  beforeEach(() => {
    navigationIntentMocks.preloadHrefRoute.mockReset();
    navigationIntentMocks.readStartupPerformanceBudget.mockReset();
    navigationIntentMocks.readStartupPerformanceBudget.mockReturnValue({
      canPreloadLikelyRoutes: true,
    });
  });

  it("preloads same-origin link targets on hover, focus and pointer down", () => {
    render(
      <>
        <NavigationIntentPreloader />
        <a href="/browse">Browse</a>
      </>,
    );

    const link = screen.getByRole("link", { name: "Browse" });
    fireEvent.mouseOver(link);
    fireEvent.focus(link);
    fireEvent.pointerDown(link);

    expect(navigationIntentMocks.preloadHrefRoute).toHaveBeenCalledTimes(3);
    expect(navigationIntentMocks.preloadHrefRoute).toHaveBeenCalledWith("/browse");
  });

  it("avoids repeated hover preloads for the same anchor", () => {
    render(
      <>
        <NavigationIntentPreloader />
        <a href="/browse">Browse</a>
      </>,
    );

    const link = screen.getByRole("link", { name: "Browse" });
    fireEvent.mouseOver(link);
    fireEvent.mouseOver(link);

    expect(navigationIntentMocks.preloadHrefRoute).toHaveBeenCalledTimes(1);
    expect(navigationIntentMocks.preloadHrefRoute).toHaveBeenCalledWith("/browse");
  });

  it("skips hover preloads on constrained startup budgets", () => {
    navigationIntentMocks.readStartupPerformanceBudget.mockReturnValue({
      canPreloadLikelyRoutes: false,
    });

    render(
      <>
        <NavigationIntentPreloader />
        <a href="/browse">Browse</a>
      </>,
    );

    const link = screen.getByRole("link", { name: "Browse" });
    fireEvent.mouseOver(link);
    fireEvent.pointerDown(link);

    expect(navigationIntentMocks.preloadHrefRoute).toHaveBeenCalledTimes(1);
    expect(navigationIntentMocks.preloadHrefRoute).toHaveBeenCalledWith("/browse");
  });

  it("ignores downloads and new-tab links", () => {
    render(
      <>
        <NavigationIntentPreloader />
        <a href="/browse" download>
          Download
        </a>
        <a href="/search" target="_blank" rel="noreferrer">
          New tab
        </a>
      </>,
    );

    fireEvent.pointerDown(screen.getByRole("link", { name: "Download" }));
    fireEvent.pointerDown(screen.getByRole("link", { name: "New tab" }));

    expect(navigationIntentMocks.preloadHrefRoute).not.toHaveBeenCalled();
  });
});
