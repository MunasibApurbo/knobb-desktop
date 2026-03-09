import {
  getControlHover,
  getControlTap,
  getMotionProfile,
  getPageTransitionVariants,
} from "@/lib/motion";

describe("motion profiles", () => {
  it("keeps edgy as the default profile", () => {
    expect(getMotionProfile().duration.base).toBe(0.42);
    expect(getMotionProfile().depth.cardLift).toBe(12);
  });

  it("uses a softer and longer roundish profile", () => {
    const edgy = getMotionProfile("edgy");
    const roundish = getMotionProfile("roundish");

    expect(roundish.duration.base).toBeGreaterThan(edgy.duration.base);
    expect(roundish.duration.ambient).toBeGreaterThan(edgy.duration.ambient);
    expect(roundish.depth.cardLift).toBeGreaterThan(edgy.depth.cardLift);
    expect(roundish.spring.shell.stiffness).toBeLessThan(edgy.spring.shell.stiffness);
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

  it("adds more expressive control motion in roundish mode", () => {
    expect(getControlHover(true, "roundish")).toMatchObject({ scale: 1.085, y: -2.8 });
    expect(getControlTap(true, "roundish")).toMatchObject({ scale: 0.94, y: 1.6 });
    expect(getControlHover(true, "edgy")).toMatchObject({ scale: 1.05, y: -1.5 });
  });
});
