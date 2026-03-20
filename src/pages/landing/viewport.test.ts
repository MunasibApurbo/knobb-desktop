import { getLandingViewportProfile, getLandingViewportStyle } from "@/pages/landing/viewport";

describe("getLandingViewportStyle", () => {
  it("keeps compact viewports at a usable scale and section height", () => {
    const style = getLandingViewportStyle(390, 844);

    expect(style["--landing-scale"]).toBe("0.5600");
    expect(style["--landing-section-gutter"]).toBe("20px");
    expect(style["--landing-content-max-width"]).toBe("350px");
    expect(style["--landing-section-min-height"]).toBe("625px");
  });

  it("preserves roomy desktop proportions without overshooting the content width", () => {
    const style = getLandingViewportStyle(1600, 1000);

    expect(style["--landing-scale"]).toBe("0.8333");
    expect(style["--landing-section-gutter"]).toBe("60px");
    expect(style["--landing-content-max-width"]).toBe("1433px");
    expect(style["--landing-section-min-height"]).toBe("920px");
  });
});

describe("getLandingViewportProfile", () => {
  it("marks phones as compact", () => {
    expect(getLandingViewportProfile(390, 844)).toEqual({
      viewportKind: "compact",
      heightKind: "regular",
      isCompact: true,
      isTabletOrSmaller: true,
      isShort: false,
    });
  });

  it("marks medium-width short screens as tablet + short", () => {
    expect(getLandingViewportProfile(1024, 768)).toEqual({
      viewportKind: "tablet",
      heightKind: "short",
      isCompact: false,
      isTabletOrSmaller: true,
      isShort: true,
    });
  });

  it("marks roomy desktops as desktop + regular", () => {
    expect(getLandingViewportProfile(1600, 1000)).toEqual({
      viewportKind: "desktop",
      heightKind: "regular",
      isCompact: false,
      isTabletOrSmaller: false,
      isShort: false,
    });
  });
});
