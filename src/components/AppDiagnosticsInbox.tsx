import { useSyncExternalStore } from "react";
import { AlertTriangle, Info, OctagonAlert, X } from "lucide-react";

import {
  dismissAppDiagnostic,
  getAppDiagnosticsSnapshot,
  subscribeToAppDiagnostics,
} from "@/lib/appDiagnostics";
import { cn } from "@/lib/utils";

function getDiagnosticIcon(level: "info" | "warn" | "error") {
  switch (level) {
    case "error":
      return OctagonAlert;
    case "warn":
      return AlertTriangle;
    default:
      return Info;
  }
}

function getDiagnosticTone(level: "info" | "warn" | "error") {
  switch (level) {
    case "error":
      return "border-red-400/30 bg-red-500/12 text-red-100";
    case "warn":
      return "border-amber-400/30 bg-amber-500/12 text-amber-100";
    default:
      return "border-white/10 bg-white/8 text-white";
  }
}

export function AppDiagnosticsInbox() {
  const diagnostics = useSyncExternalStore(
    subscribeToAppDiagnostics,
    getAppDiagnosticsSnapshot,
    getAppDiagnosticsSnapshot,
  );

  if (diagnostics.length === 0) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-40 flex w-[min(100vw-2rem,24rem)] flex-col gap-2">
      {diagnostics.slice(0, 3).map((diagnostic) => {
        const Icon = getDiagnosticIcon(diagnostic.level);

        return (
          <div
            key={diagnostic.id}
            className={cn(
              "pointer-events-auto overflow-hidden border backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
              getDiagnosticTone(diagnostic.level),
            )}
          >
            <div className="flex items-start gap-3 px-3 py-3">
              <span className="mt-0.5 shrink-0">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{diagnostic.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/72">{diagnostic.message}</p>
                {diagnostic.source ? (
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
                    {diagnostic.source}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissAppDiagnostic(diagnostic.id)}
                className="inline-flex h-7 w-7 items-center justify-center text-white/55 transition-colors hover:text-white"
                aria-label="Dismiss notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

