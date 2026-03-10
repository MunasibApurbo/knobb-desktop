import { fireEvent, render, screen } from "@testing-library/react";

import { ConnectDeviceDialog } from "@/components/ConnectDeviceDialog";

const setSinkId = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/ui/button", async () => {
  const React = await import("react");

  return {
    Button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function MockButton(
      { children, ...props },
      ref,
    ) {
      return (
        <button ref={ref} type="button" {...props}>
          {children}
        </button>
      );
    }),
  };
});

vi.mock("@/lib/audioEngine", () => ({
  getAudioEngine: () => ({
    getSinkId: () => "default",
    setSinkId,
    supportsSinkSelection: () => false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
  }),
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => ({
    restoreRemoteSession: vi.fn(),
  }),
}));

vi.mock("@/lib/playbackSessions", () => ({
  getPlaybackDeviceId: () => "current-device",
  listPlaybackSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("ConnectDeviceDialog", () => {
  it("opens the device picker without a full-window overlay", () => {
    const { container } = render(<ConnectDeviceDialog />);

    fireEvent.click(screen.getByTitle("Connect to a device"));

    const currentDeviceCard = screen.getByRole("button", { name: /this computer current audio output/i });
    const handoffCard = screen.getByText("Sign in for account handoff");

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("Connect")).toBeInTheDocument();
    expect(screen.getByText("No other devices found")).toBeInTheDocument();
    expect(currentDeviceCard.className).toContain("rounded-[var(--surface-radius-lg)]");
    expect(handoffCard.parentElement?.parentElement?.className).toContain("rounded-[var(--surface-radius-md)]");
    expect(container.ownerDocument.querySelector(".bg-black\\/80")).toBeNull();
  });
});
