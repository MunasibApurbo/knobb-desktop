import { fireEvent, render, screen } from "@testing-library/react";
import type { MotionValue } from "framer-motion";
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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("opens the edit-name action after the menu closes", () => {
    const onEditDisplayName = vi.fn();

    render(
      <ProfileHero
        displayName="Knobb Listener"
        email="listener@example.com"
        createdAt="2026-01-05T00:00:00.000Z"
        heroImage={null}
        scrollY={{ get: () => 0 } as MotionValue<number>}
        onEditDisplayName={onEditDisplayName}
        onChangeCoverImage={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Edit Display Name"));

    expect(onEditDisplayName).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(onEditDisplayName).toHaveBeenCalledTimes(1);
  });
});
