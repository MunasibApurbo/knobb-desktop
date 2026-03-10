import { render, screen } from "@testing-library/react";

import { DiscordConnectDialog } from "@/components/DiscordConnectDialog";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string, values?: Record<string, string>) => {
      if (key === "common.close") return "Close";
      if (key === "settings.discordConnectDialogTitle") return "Connect Discord";
      if (key === "settings.discordConnectDialogDescription") {
        return "Knobb Desktop can publish Discord activity directly on the same machine as Discord.";
      }
      if (key === "settings.discordBridgeMissing") return "Discord activity requires Knobb Desktop.";
      if (key === "settings.discordBridgeStatusOffline") return "Desktop required";
      if (key === "settings.discordBridgeReady") return "Ready";
      if (key === "settings.discordBridgeStatusSetupRequired") return "Setup required";
      if (key === "settings.discordBridgeStatusConnected") return "Connected";
      if (key === "settings.discordBridgeStatusWaiting") return "Waiting for Discord";
      if (key === "settings.discordBridge") return "Knobb Desktop";
      if (key === "settings.discordConfig") return "Config";
      if (key === "settings.discordDesktop") return "Discord";
      if (key === "settings.discordConfigStepTitle") return "Add config";
      if (key === "settings.discordConfigStepDescription") return "Create the bridge config file.";
      if (key === "settings.discordConfigFile") return "Config file";
      if (key === "settings.copyConfigTemplate") return "Copy config template";
      if (key === "settings.discordCompanionStepTitle") return "Run companion";
      if (key === "settings.discordCompanionStepDescription") return "Run Knobb Desktop on the same machine.";
      if (key === "settings.copyCompanionCommand") return "Copy command";
      if (key === "settings.discordDesktopStepTitle") return "Finish setup";
      if (key === "settings.discordDesktopStepDescription") return "Reconnect after launching the desktop app.";
      if (key === "settings.refreshStatus") return "Refresh status";
      if (key === "settings.enableDiscordPresence") return "Enable Discord presence";
      if (key === "settings.discordAppConnected") return "Connected";
      if (key === "settings.discordAppWaiting") return "Waiting";
      if (key === "settings.discordBridgeSetupRequired") return "Setup required";
      if (key === "settings.discordDesktopAppRunning") return "Knobb Desktop is already running";
      if (key === "settings.copyFailed") return "Copy failed";
      if (key === "settings.discordStatusRefreshFailed") return "Refresh failed";
      if (key === "settings.discordPresenceEnabledToast") return "Discord activity status enabled";
      if (key === "settings.discordPresenceEnabled") return "Discord presence enabled";
      if (key === "settings.discordConfigDesktopStepDescription") {
        return `Create the bridge config file in ${values?.path ?? "the desktop config folder"}.`;
      }
      if (key === "settings.discordConfigTemplateCopied") return "Config copied";
      if (key === "settings.discordConfigPathCopied") return "Path copied";
      if (key === "settings.revealConfigFile") return "Reveal config file";
      if (key === "settings.openConfigFolder") return "Open config folder";
      if (key === "settings.copyConfigPath") return "Copy config path";
      if (key === "settings.discordCommandCopied") return "Command copied";
      return key;
    },
  }),
}));

vi.mock("@/lib/localDiscordPresenceBridge", () => ({
  refreshLocalDiscordPresenceBridgeStatus: vi.fn().mockResolvedValue({
    ok: false,
    configured: false,
    discordConnected: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("DiscordConnectDialog", () => {
  it("renders the setup modal content when open", () => {
    render(
      <DiscordConnectDialog
        open
        onOpenChange={vi.fn()}
        presenceEnabled={false}
        status={{ ok: false, configured: false, discordConnected: false }}
        onEnablePresence={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("Connect Discord")).toBeInTheDocument();
    expect(screen.getByText("Copy config template")).toBeInTheDocument();
    expect(screen.getByText("Refresh status")).toBeInTheDocument();
  });
});
