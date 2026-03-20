import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import NotificationsPage from "@/pages/NotificationsPage";

const notificationsPageMocks = vi.hoisted(() => {
  const pendingLoad = new Promise<never>(() => {});

  return {
    user: { id: "user-1" } as { id: string } | null,
    loadResponse: pendingLoad as Promise<{ data: unknown[] | null; error: unknown }>,
    subscription: { unsubscribe: vi.fn() },
    removeChannel: vi.fn(),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: notificationsPageMocks.user,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => notificationsPageMocks.loadResponse,
        }),
      }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => notificationsPageMocks.subscription,
      }),
    }),
    removeChannel: notificationsPageMocks.removeChannel,
  },
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("NotificationsPage", () => {
  beforeEach(() => {
    notificationsPageMocks.user = { id: "user-1" };
    notificationsPageMocks.subscription.unsubscribe.mockReset();
    notificationsPageMocks.removeChannel.mockReset();
    notificationsPageMocks.loadResponse = new Promise(() => {});
  });

  it("shows a loading panel while notifications are still fetching", () => {
    render(<NotificationsPage />);

    expect(screen.getByText("Loading notifications")).toBeInTheDocument();
    expect(screen.getByText("Checking for playlist activity, updates, and library events.")).toBeInTheDocument();
  });
});
