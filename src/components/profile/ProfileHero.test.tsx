import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    className,
  }: {
    children: ReactNode;
    onSelect?: () => void;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
}));

import { ProfileHero } from "@/components/profile/ProfileHero";

describe("ProfileHero", () => {
  it("opens the edit-name action directly from the menu", () => {
    const onEditDisplayName = vi.fn();

    render(
      <ProfileHero
        displayName="Knobb Listener"
        email="listener@example.com"
        createdAt="2026-01-05T00:00:00.000Z"
        heroImage={null}
        onEditDisplayName={onEditDisplayName}
        onChangeCoverImage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Edit Display Name"));

    expect(onEditDisplayName).toHaveBeenCalledTimes(1);
  });

  it("opens the banner picker directly from the menu", () => {
    const onChangeCoverImage = vi.fn();

    render(
      <ProfileHero
        displayName="Knobb Listener"
        email="listener@example.com"
        createdAt="2026-01-05T00:00:00.000Z"
        heroImage={null}
        onEditDisplayName={vi.fn()}
        onChangeCoverImage={onChangeCoverImage}
      />,
    );

    fireEvent.click(screen.getByText("Change Banner Image"));

    expect(onChangeCoverImage).toHaveBeenCalledTimes(1);
  });
});
