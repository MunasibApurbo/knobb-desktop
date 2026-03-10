import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";

import NotificationsPage from "@/pages/NotificationsPage";

const notificationsMocks = vi.hoisted(() => {
  const items = [
    {
      id: "notif-1",
      type: "playlist",
      title: "Playlist updated",
      body: "Night Drive has 3 new tracks.",
      is_read: false,
      created_at: "2026-03-08T10:00:00.000Z",
    },
  ];

  const queryChain = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
  };

  queryChain.select.mockReturnValue(queryChain);
  queryChain.order.mockReturnValue(queryChain);
  queryChain.limit.mockResolvedValue({ data: items, error: null });
  queryChain.update.mockReturnValue(queryChain);
  queryChain.eq.mockReturnValue(queryChain);

  return {
    items,
    from: vi.fn(() => queryChain),
    removeChannel: vi.fn(),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: notificationsMocks.from,
    channel: () => ({
      on: () => ({
        subscribe: () => ({ id: "channel-1" }),
      }),
    }),
    removeChannel: notificationsMocks.removeChannel,
  },
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("NotificationsPage mobile layout", () => {
  it("renders notifications inside the mobile utility shell with a stacked action header", async () => {
    const { container } = render(<NotificationsPage />);

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all read/i })).toBeInTheDocument();
    expect(container.querySelector(".mobile-page-shell")).not.toBeNull();
    await waitFor(() => {
      expect(screen.queryByText("Loading notifications...")).not.toBeInTheDocument();
    });
  });
});
