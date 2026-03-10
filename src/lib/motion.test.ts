import {
  getControlHover,
  getControlTap,
  getMotionProfile,
  getPageTransitionVariants,
} from "@/lib/motion";

describe("motion profiles", () => {
  it("uses the roundish profile by default", () => {
    expect(getMotionProfile().duration.base).toBe(0.56);
    expect(getMotionProfile().depth.cardLift).toBe(16);
  });

  it("returns the same profile when roundish is requested explicitly", () => {
    expect(getMotionProfile("roundish")).toEqual(getMotionProfile());
  });

  it("returns neutral variants and no control motion when motion is disabled", () => {
    expect(getPageTransitionVariants(false, "roundish")).toEqual({
      initial: { opacity: 1, y: 0, scale: 1 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 1, y: 0, scale: 1 },
    });
    expect(getControlHover(false, "roundish")).toBeUndefined();
    expect(getControlTap(false, "roundish")).toBeUndefined();
  });

  it("uses the roundish control motion profile", () => {
    expect(getControlHover(true, "roundish")).toMatchObject({ scale: 1.085, y: -2.8 });
    expect(getControlTap(true, "roundish")).toMatchObject({ scale: 0.94, y: 1.6 });
  });
});
