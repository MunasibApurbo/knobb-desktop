import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("./pages/LandingPage", () => ({
  default: () => <div>Landing page</div>,
}));

vi.mock("./pages/landing/LandingContactPage", () => ({
  default: () => <div>Landing contact page</div>,
}));

vi.mock("./InternalApp", () => ({
  default: () => <div>Internal app</div>,
}));

import App from "@/App";

describe("App routing", () => {
  let container: HTMLDivElement;
  let root: Root;
  let previousActEnvironment: boolean | undefined;
  let previousKnobbDesktop: Window["knobbDesktop"];

  beforeAll(() => {
    previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  beforeEach(() => {
    previousKnobbDesktop = window.knobbDesktop;
    delete window.knobbDesktop;
    window.history.pushState({}, "", "/");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    window.knobbDesktop = previousKnobbDesktop;
    container.remove();
  });

  it("renders the internal app when /liked is loaded directly", async () => {
    window.history.pushState({}, "", "/liked");

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Internal app");
  });

  it("keeps the public contact route on the marketing page", async () => {
    window.history.pushState({}, "", "/contact");

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Landing contact page");
  });

  it("redirects desktop builds away from the landing page", async () => {
    window.knobbDesktop = {
      isDesktopApp: true,
      platform: "darwin",
      getLaunchTarget: vi.fn().mockResolvedValue(null),
      openExternal: vi.fn().mockResolvedValue(true),
    };

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.location.pathname).toBe("/app");
    expect(container.textContent).toContain("Internal app");
  });
});
