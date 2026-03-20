import { getPreloadablePathname, normalizePathname } from "@/lib/routePreload";

describe("routePreload", () => {
  it("normalizes internal route targets", () => {
    expect(normalizePathname("/browse?tab=genres#top")).toBe("/browse");
    expect(getPreloadablePathname("/search?q=khruangbin")).toBe("/search");
    expect(getPreloadablePathname("http://localhost:3000/album/tidal-123?foo=bar")).toBe("/album/tidal-123");
  });

  it("skips non-preloadable targets", () => {
    expect(getPreloadablePathname("#details")).toBeNull();
    expect(getPreloadablePathname("mailto:hello@example.com")).toBeNull();
    expect(getPreloadablePathname("https://example.com/browse")).toBeNull();
  });
});
