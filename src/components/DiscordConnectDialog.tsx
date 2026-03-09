import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Copy, Loader2, RefreshCw, TerminalSquare, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getKnobbDesktop,
  getKnobbDesktopConfigDirectory,
  getKnobbDesktopConfigFilePath,
  isKnobbDesktopApp,
} from "@/lib/desktopApp";
import { getDiscordBridgeConfigTemplate, getDiscordConnectionState } from "@/lib/discordConnect";
import {
  refreshLocalDiscordPresenceBridgeStatus,
  type LocalDiscordPresenceBridgeStatus,
} from "@/lib/localDiscordPresenceBridge";

type DiscordConnectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presenceEnabled: boolean;
  status: LocalDiscordPresenceBridgeStatus;
  onEnablePresence: () => void;
};

const DESKTOP_COMMAND = "npm run desktop:app";

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn";
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.035] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${tone === "ok" ? "bg-emerald-400" : "bg-amber-300"}`} />
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function DiscordConnectDialog({
  open,
  onOpenChange,
  presenceEnabled,
  status,
  onEnablePresence,
}: DiscordConnectDialogProps) {
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [configDirectory, setConfigDirectory] = useState<string | null>(null);
  const [configFilePath, setConfigFilePath] = useState<string | null>(null);
  const connectionState = getDiscordConnectionState(status);
  const desktopApp = isKnobbDesktopApp();
  const siteUrl = typeof window === "undefined" ? "https://your-knobb-site.example.com" : window.location.origin;
  const configTemplate = getDiscordBridgeConfigTemplate(siteUrl);

  const bridgeLabel = status.ok ? t("settings.discordBridgeReady") : t("settings.discordBridgeStatusOffline");
  const configLabel = status.ok
    ? (status.configured ? t("settings.discordBridgeReady") : t("settings.discordBridgeStatusSetupRequired"))
    : t("settings.discordBridgeStatusOffline");
  const desktopLabel = status.discordConnected
    ? t("settings.discordBridgeStatusConnected")
    : t("settings.discordBridgeStatusWaiting");
  const summary = connectionState === "offline"
    ? t("settings.discordBridgeMissing")
    : connectionState === "setup"
      ? t("settings.discordBridgeSetupRequired")
      : connectionState === "waiting"
        ? t("settings.discordAppWaiting")
        : t("settings.discordAppConnected");

  useEffect(() => {
    if (!desktopApp) {
      setConfigDirectory(null);
      setConfigFilePath(null);
      return;
    }

    void getKnobbDesktopConfigDirectory().then((nextValue) => {
      setConfigDirectory(nextValue);
    });
    void getKnobbDesktopConfigFilePath().then((nextValue) => {
      setConfigFilePath(nextValue);
    });
  }, [desktopApp]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  const handleCopy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error(t("settings.copyFailed"));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshLocalDiscordPresenceBridgeStatus();
    } catch {
      toast.error(t("settings.discordStatusRefreshFailed"));
    } finally {
      setRefreshing(false);
    }
  };

  const handleEnablePresence = () => {
    onEnablePresence();
    toast.success(t("settings.discordPresenceEnabledToast"));
    onOpenChange(false);
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discord-connect-title"
        aria-describedby="discord-connect-description"
        className="absolute left-1/2 top-1/2 z-[91] w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[var(--overlay-radius)] border border-white/10 bg-black/95 text-white shadow-2xl"
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">{t("common.close")}</span>
        </button>

        <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="space-y-2 text-left">
              <h2 id="discord-connect-title" className="text-2xl font-bold tracking-tight text-white">
                {t("settings.discordConnectDialogTitle")}
              </h2>
              <p id="discord-connect-description" className="text-sm text-white/60">
                {t("settings.discordConnectDialogDescription")}
              </p>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-white/72">{summary}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <StatusCard
                  label={t("settings.discordBridge")}
                  value={bridgeLabel}
                  tone={status.ok ? "ok" : "warn"}
                />
                <StatusCard
                  label={t("settings.discordConfig")}
                  value={configLabel}
                  tone={status.ok && status.configured ? "ok" : "warn"}
                />
                <StatusCard
                  label={t("settings.discordDesktop")}
                  value={desktopLabel}
                  tone={status.discordConnected ? "ok" : "warn"}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                  {t("settings.discordConfigStepTitle")}
                </p>
                <p className="mt-3 text-sm text-white/72">
                  {desktopApp && configDirectory
                    ? t("settings.discordConfigDesktopStepDescription", { path: configDirectory })
                    : t("settings.discordConfigStepDescription")}
                </p>
                {desktopApp && configFilePath ? (
                  <div className="mt-4 rounded-[18px] border border-white/10 bg-black/35 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
                      {t("settings.discordConfigFile")}
                    </p>
                    <code className="mt-3 block break-all text-xs text-white/82">{configFilePath}</code>
                  </div>
                ) : null}
                <pre className="mt-4 overflow-x-auto rounded-[18px] border border-white/10 bg-black/50 p-4 text-xs text-white/78">
                  <code>{configTemplate}</code>
                </pre>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="h-11 border-white/12 bg-white/[0.03] px-4 text-sm font-semibold text-white hover:bg-white/[0.08]"
                    onClick={() => void handleCopy(configTemplate, t("settings.discordConfigTemplateCopied"))}
                  >
                    <Copy className="h-4 w-4" />
                    {t("settings.copyConfigTemplate")}
                  </Button>
                  {desktopApp ? (
                    <>
                      {configFilePath ? (
                        <Button
                          variant="outline"
                          className="h-11 border-white/12 bg-white/[0.03] px-4 text-sm font-semibold text-white hover:bg-white/[0.08]"
                          onClick={() => void handleCopy(configFilePath, t("settings.discordConfigPathCopied"))}
                        >
                          <Copy className="h-4 w-4" />
                          {t("settings.copyConfigPath")}
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        className="h-11 border-white/12 bg-white/[0.03] px-4 text-sm font-semibold text-white hover:bg-white/[0.08]"
                        onClick={() => {
                          void getKnobbDesktop()?.revealConfigFile?.();
                        }}
                      >
                        <TerminalSquare className="h-4 w-4" />
                        {t("settings.revealConfigFile")}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 border-white/12 bg-white/[0.03] px-4 text-sm font-semibold text-white hover:bg-white/[0.08]"
                        onClick={() => {
                          void getKnobbDesktop()?.openConfigDirectory?.();
                        }}
                      >
                        <TerminalSquare className="h-4 w-4" />
                        {t("settings.openConfigFolder")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                    {t("settings.discordCompanionStepTitle")}
                  </p>
                  <p className="mt-3 text-sm text-white/72">{t("settings.discordCompanionStepDescription")}</p>
                  <code className="mt-4 block rounded-[18px] border border-white/10 bg-black/50 px-4 py-3 text-sm text-white/88">
                    {desktopApp ? t("settings.discordDesktopAppRunning") : DESKTOP_COMMAND}
                  </code>
                  {!desktopApp ? (
                    <Button
                      variant="outline"
                      className="mt-4 h-11 border-white/12 bg-white/[0.03] px-4 text-sm font-semibold text-white hover:bg-white/[0.08]"
                      onClick={() => void handleCopy(DESKTOP_COMMAND, t("settings.discordCommandCopied"))}
                    >
                      <TerminalSquare className="h-4 w-4" />
                      {t("settings.copyCompanionCommand")}
                    </Button>
                  ) : null}
                </div>

                <div className="rounded-[18px] border border-white/10 bg-black/35 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                    {t("settings.discordDesktopStepTitle")}
                  </p>
                  <p className="mt-3 text-sm text-white/72">{t("settings.discordDesktopStepDescription")}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                className="h-11 border-white/12 bg-white/[0.03] px-5 text-sm font-semibold text-white hover:bg-white/[0.08]"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("settings.refreshStatus")}
              </Button>

              <div className="flex flex-col gap-3 sm:flex-row">
                {presenceEnabled ? (
                  <div className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--control-radius)] border border-emerald-400/25 bg-emerald-400/10 px-5 text-sm font-semibold text-emerald-100">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("settings.discordPresenceEnabled")}
                  </div>
                ) : (
                  <Button
                    className="h-11 bg-white px-5 text-sm font-semibold text-black hover:bg-white/90"
                    onClick={handleEnablePresence}
                    disabled={connectionState !== "connected"}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t("settings.enableDiscordPresence")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
