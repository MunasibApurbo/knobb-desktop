type AppDiagnosticLevel = "info" | "warn" | "error";

export type AppDiagnostic = {
  id: string;
  level: AppDiagnosticLevel;
  title: string;
  message: string;
  source?: string;
  createdAt: number;
  sticky?: boolean;
};

type PushAppDiagnosticArgs = {
  level: AppDiagnosticLevel;
  title: string;
  message: string;
  source?: string;
  sticky?: boolean;
  dedupeKey?: string;
};

const DIAGNOSTIC_LIMIT = 6;
const DIAGNOSTIC_DEDUPE_MS = 12_000;

let diagnostics: AppDiagnostic[] = [];
const listeners = new Set<() => void>();
const duplicateWindow = new Map<string, number>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function buildDiagnosticId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function shouldSkipDuplicate(key: string) {
  const now = Date.now();
  const last = duplicateWindow.get(key) ?? 0;
  if (now - last < DIAGNOSTIC_DEDUPE_MS) return true;
  duplicateWindow.set(key, now);
  return false;
}

export function subscribeToAppDiagnostics(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAppDiagnosticsSnapshot() {
  return diagnostics;
}

export function dismissAppDiagnostic(id: string) {
  const nextDiagnostics = diagnostics.filter((diagnostic) => diagnostic.id !== id);
  if (nextDiagnostics.length === diagnostics.length) return;
  diagnostics = nextDiagnostics;
  emitChange();
}

export function pushAppDiagnostic({
  level,
  title,
  message,
  source,
  sticky = false,
  dedupeKey,
}: PushAppDiagnosticArgs) {
  const key = dedupeKey || `${level}:${title}:${message}`;
  if (shouldSkipDuplicate(key)) return null;

  const diagnostic: AppDiagnostic = {
    id: buildDiagnosticId(),
    level,
    title,
    message,
    source,
    createdAt: Date.now(),
    sticky,
  };

  diagnostics = [diagnostic, ...diagnostics].slice(0, DIAGNOSTIC_LIMIT);
  emitChange();

  if (!sticky && typeof window !== "undefined") {
    window.setTimeout(() => {
      dismissAppDiagnostic(diagnostic.id);
    }, level === "error" ? 16_000 : 10_000);
  }

  return diagnostic.id;
}
