import { getResponsiveMediaCardColumnsForWidth } from "@/hooks/useResponsiveMediaCardCount";

describe("getResponsiveMediaCardColumnsForWidth", () => {
  it("switches to the compact desktop density breakpoint", () => {
    expect(getResponsiveMediaCardColumnsForWidth(959, "default")).toBe(2);
    expect(getResponsiveMediaCardColumnsForWidth(960, "default")).toBe(5);
    expect(getResponsiveMediaCardColumnsForWidth(1280, "default")).toBe(6);
    expect(getResponsiveMediaCardColumnsForWidth(1440, "default")).toBe(7);
  });
});
