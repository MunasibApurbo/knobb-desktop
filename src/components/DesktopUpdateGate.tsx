import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useKnobbDesktopUpdate } from "@/hooks/useKnobbDesktopUpdate";
import { getDesktopUpdatePresentation, isDesktopUpdateBlocked } from "@/lib/desktopUpdatePresentation";

export function DesktopUpdateGate() {
  const { desktopApp, installUpdate, quitApp, refreshStatus, status } = useKnobbDesktopUpdate();

  if (!desktopApp || !isDesktopUpdateBlocked(status)) {
    return null;
  }

  const presentation = getDesktopUpdatePresentation(status);
  const isChecking = status?.status === "checking";
  const isDownloading = status?.status === "downloading";

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/88 px-6 backdrop-blur-md">
      <div className="w-full max-w-xl border border-white/12 bg-[#060606] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.55)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/42">Required update</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">{presentation.title}</h2>
        <p className="mt-3 text-sm leading-6 text-white/68">{presentation.detail}</p>

        {presentation.progress !== null ? (
          <div className="mt-5 space-y-2">
            <div className="h-2 w-full overflow-hidden bg-white/10">
              <div
                className="h-full bg-white transition-[width] duration-300"
                style={{ width: `${presentation.progress}%` }}
              />
            </div>
            <p className="text-xs text-white/48">{Math.round(presentation.progress)}% downloaded</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {presentation.primaryAction === "install" ? (
            <Button className="h-11 rounded-none bg-white px-5 text-black hover:bg-white/90" onClick={() => void installUpdate()}>
              Restart and update
            </Button>
          ) : null}

          {presentation.primaryAction === "retry" ? (
            <Button
              variant="outline"
              className="h-11 rounded-none border-white/12 bg-white/[0.04] px-5 text-white hover:bg-white/[0.1] hover:text-white"
              onClick={() => void refreshStatus()}
              disabled={isChecking || isDownloading}
            >
              {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Retry update check
            </Button>
          ) : null}

          <Button
            variant="outline"
            className="h-11 rounded-none border-white/12 bg-white/[0.02] px-5 text-white/82 hover:bg-white/[0.08] hover:text-white"
            onClick={() => void quitApp()}
          >
            Quit app
          </Button>
        </div>
      </div>
    </div>
  );
}
