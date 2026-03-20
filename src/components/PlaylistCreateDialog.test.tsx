import { fireEvent, render, screen } from "@testing-library/react";

import { PlaylistCreateDialog } from "@/components/PlaylistCreateDialog";

describe("PlaylistCreateDialog", () => {
  it("renders the playlist form controls when opened", () => {
    const handleOpenChange = vi.fn();
    const handleSubmit = vi.fn();
    const handleValueChange = vi.fn();

    render(
      <PlaylistCreateDialog
        open
        onOpenChange={handleOpenChange}
        onSubmit={handleSubmit}
        onValueChange={handleValueChange}
        value="Night Drive"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Create Playlist" })).toBeVisible();
    expect(screen.getByLabelText("Playlist name")).toHaveValue("Night Drive");
    expect(screen.getByLabelText("Playlist description")).toBeVisible();
    expect(screen.getByText("Name your playlist, add optional artwork or notes, and choose whether it stays private or public.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload cover" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("closes when cancel is pressed", () => {
    const handleOpenChange = vi.fn();

    render(
      <PlaylistCreateDialog
        open
        onOpenChange={handleOpenChange}
        onSubmit={vi.fn()}
        onValueChange={vi.fn()}
        value="Night Drive"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
