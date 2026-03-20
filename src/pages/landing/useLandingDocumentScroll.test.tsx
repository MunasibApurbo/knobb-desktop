import { render } from "@testing-library/react";

import { useLandingDocumentScroll } from "@/pages/landing/useLandingDocumentScroll";

function LandingScrollProbe() {
  useLandingDocumentScroll();
  return null;
}

describe("useLandingDocumentScroll", () => {
  afterEach(() => {
    document.documentElement.style.overflowY = "";
    document.documentElement.style.overscrollBehaviorY = "";
    document.body.style.overflow = "";
    document.body.style.overflowX = "";
    document.body.style.overflowY = "";
    document.body.style.overscrollBehavior = "";
  });

  it("enables document scrolling while a landing route is mounted", () => {
    render(<LandingScrollProbe />);

    expect(document.documentElement.style.overflowY).toBe("auto");
    expect(document.documentElement.style.overscrollBehaviorY).toBe("auto");
    expect(document.body.style.overflow).toBe("auto");
    expect(document.body.style.overflowX).toBe("hidden");
    expect(document.body.style.overflowY).toBe("auto");
    expect(document.body.style.overscrollBehavior).toBe("auto");
  });

  it("restores the previous document styles when the landing route unmounts", () => {
    document.documentElement.style.overflowY = "clip";
    document.documentElement.style.overscrollBehaviorY = "contain";
    document.body.style.overflow = "hidden";
    document.body.style.overflowX = "clip";
    document.body.style.overflowY = "hidden";
    document.body.style.overscrollBehavior = "none";

    const { unmount } = render(<LandingScrollProbe />);

    unmount();

    expect(document.documentElement.style.overflowY).toBe("clip");
    expect(document.documentElement.style.overscrollBehaviorY).toBe("contain");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.overflowX).toBe("clip");
    expect(document.body.style.overflowY).toBe("hidden");
    expect(document.body.style.overscrollBehavior).toBe("none");
  });

  it("keeps document scrolling enabled until all landing routes unmount", () => {
    const first = render(<LandingScrollProbe />);
    const second = render(<LandingScrollProbe />);

    first.unmount();

    expect(document.documentElement.style.overflowY).toBe("auto");
    expect(document.body.style.overflowY).toBe("auto");

    second.unmount();

    expect(document.documentElement.style.overflowY).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.overflowY).toBe("");
  });
});
