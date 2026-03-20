import { getHeroScrollStyles } from "@/lib/heroVisuals";

describe("hero scroll styles", () => {
  it("keeps the hero at rest when scroll is not positive", () => {
    expect(getHeroScrollStyles(-64)).toEqual({
      scrollScale: 1,
      scrollBlur: 0,
      scrollOpacity: 1,
    });
  });

  it("ramps blur and scale up with scroll", () => {
    const styles = getHeroScrollStyles(160);

    expect(styles.scrollScale).toBeCloseTo(1.06);
    expect(styles.scrollBlur).toBeCloseTo(8);
    expect(styles.scrollOpacity).toBeCloseTo(0.888);
  });

  it("caps the blur curve for deep scroll positions", () => {
    const styles = getHeroScrollStyles(960);

    expect(styles.scrollScale).toBeCloseTo(1.12);
    expect(styles.scrollBlur).toBeCloseTo(16);
    expect(styles.scrollOpacity).toBeCloseTo(0.84);
  });
});
