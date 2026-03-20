import { fireEvent, render, screen } from "@testing-library/react";

import { VolumeBar } from "@/components/VolumeBar";

vi.mock("framer-motion", async () => {
  const React = await import("react");

  return {
    motion: {
      div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function MotionDiv(
        { children, ...props },
        ref,
      ) {
        return <div ref={ref} {...props}>{children}</div>;
      }),
    },
  };
});

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: false,
  }),
}));

describe("VolumeBar", () => {
  it("exposes slider semantics", () => {
    render(
      <VolumeBar
        ariaLabel="Playback volume"
        volume={0.35}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("slider", { name: "Playback volume" })).toHaveAttribute("aria-valuenow", "35");
  });

  it("supports keyboard adjustments", () => {
    const onChange = vi.fn();

    render(
      <VolumeBar
        ariaLabel="Playback volume"
        volume={0.5}
        onChange={onChange}
      />,
    );

    const slider = screen.getByRole("slider", { name: "Playback volume" });

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "PageUp" });
    fireEvent.keyDown(slider, { key: "Home" });
    fireEvent.keyDown(slider, { key: "End" });

    expect(onChange).toHaveBeenNthCalledWith(1, 0.55);
    expect(onChange).toHaveBeenNthCalledWith(2, 0.6);
    expect(onChange).toHaveBeenNthCalledWith(3, 0);
    expect(onChange).toHaveBeenNthCalledWith(4, 1);
  });
});
