import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("marks playback and detail action buttons as allowing global shortcuts", () => {
    render(
      <>
        <Button className="bottom-player-control">Transport</Button>
        <Button className="detail-action-button">Action</Button>
        <Button allowGlobalShortcuts>Explicit</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Transport" })).toHaveAttribute("data-allow-global-shortcuts", "true");
    expect(screen.getByRole("button", { name: "Action" })).toHaveAttribute("data-allow-global-shortcuts", "true");
    expect(screen.getByRole("button", { name: "Explicit" })).toHaveAttribute("data-allow-global-shortcuts", "true");
  });
});
