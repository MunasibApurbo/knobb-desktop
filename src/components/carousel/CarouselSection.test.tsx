import { render } from "@testing-library/react";

import { CarouselSection } from "@/components/carousel/CarouselSection";
import type { CarouselApi } from "@/hooks/useCarousel";

function createCarouselApi(): CarouselApi {
  return {
    sectionPageIndexes: {},
    draggingSections: {},
    getPageCount: (itemsLength) => Math.max(1, Math.ceil(itemsLength / 2)),
    getCurrentPage: () => 0,
    getSectionPages: <T,>(items: T[]) => [items],
    moveSectionPage: vi.fn(),
    shouldShowPager: () => false,
    canViewAll: () => false,
    setFrameRef: () => vi.fn(),
    setTrackRef: () => vi.fn(),
    rowStyle: { "--home-row-columns": 2 } as React.CSSProperties,
    cardCount: 2,
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    finishDrag: vi.fn(),
    cancelDrag: vi.fn(),
    handleClickCapture: vi.fn(),
    registerItemCount: vi.fn(),
  };
}

describe("CarouselSection", () => {
  it("renders a plain carousel track so home shelves stay on the native render path", () => {
    const { container } = render(
      <CarouselSection
        items={["one", "two"]}
        sectionKey="recommended"
        carousel={createCarouselApi()}
        renderItem={(item) => <div key={item}>{item}</div>}
      />,
    );

    const track = container.querySelector(".home-section-carousel-track");
    expect(track).not.toHaveAttribute("data-motion-initial");
    expect(track).not.toHaveAttribute("data-motion-animate");
  });
});
