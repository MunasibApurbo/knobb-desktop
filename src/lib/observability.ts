import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type EventLevel = "info" | "warn" | "error";

type ClientEvent = {
  id: string;
  level: EventLevel;
  eventName: string;
  message: string;
  payload: Record<string, unknown>;
  source: string;
  createdAt: string;
};

type ReportClientEventArgs = {
  level: EventLevel;
  eventName: string;
  message?: string;
  payload?: Record<string, unknown>;
  source?: string;
};

const LOCAL_EVENT_LIMIT = 120;
const DUPLICATE_WINDOW_MS = 7_500;
const LATENCY_REPORT_COOLDOWN_MS = 2 * 60 * 1000;
const DEFAULT_SOURCE = "web-client";

const localEvents: ClientEvent[] = [];
const duplicateWindow = new Map<string, number>();
const latencyBudgetWindow = new Map<string, number>();

function nowIso() {
  return new Date().toISOString();
}

function buildKey(level: EventLevel, eventName: string, message: string) {
  return `${level}::${eventName}::${message}`;
}

function shouldSkipDuplicate(key: string) {
  const now = Date.now();
  const last = duplicateWindow.get(key) ?? 0;
  if (now - last < DUPLICATE_WINDOW_MS) return true;
  duplicateWindow.set(key, now);
  return false;
}

function pushLocalEvent(event: ClientEvent) {
  localEvents.unshift(event);
  if (localEvents.length > LOCAL_EVENT_LIMIT) localEvents.length = LOCAL_EVENT_LIMIT;
}

function createClientEvent({
  level,
  eventName,
  message,
  payload = {},
  source = DEFAULT_SOURCE,
}: ReportClientEventArgs): ClientEvent {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    eventName,
    message: message || "",
    payload,
    source,
    createdAt: nowIso(),
  };
}

export async function reportClientEvent(args: ReportClientEventArgs) {
  const event = createClientEvent(args);
  const dedupeKey = buildKey(event.level, event.eventName, event.message);
  if (shouldSkipDuplicate(dedupeKey)) return;

  pushLocalEvent(event);

  try {
    await supabase.rpc("log_client_event", {
      level_input: event.level,
      event_name_input: event.eventName,
      message_input: event.message || null,
      payload_input: event.payload as Json,
      source_input: event.source,
    });
  } catch {
    // no-op: diagnostics should never break UX
  }
}

export async function reportClientError(
  error: unknown,
  eventName = "client_error",
  payload: Record<string, unknown> = {},
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  await reportClientEvent({
    level: "error",
    eventName,
    message,
    payload,
  });
}

export async function reportLatencyBudgetExceeded(
  endpoint: string,
  p95Ms: number,
  budgetMs: number,
) {
  const now = Date.now();
  const key = endpoint.trim().toLowerCase();
  const last = latencyBudgetWindow.get(key) ?? 0;
  if (now - last < LATENCY_REPORT_COOLDOWN_MS) return;
  latencyBudgetWindow.set(key, now);

  await reportClientEvent({
    level: "warn",
    eventName: "api_latency_budget_exceeded",
    message: `p95 latency exceeded for ${endpoint}`,
    payload: {
      endpoint,
      p95Ms,
      budgetMs,
    },
    source: "nobbb-music",
  });
}

export function getLocalClientEventsSnapshot(limit = 12): ClientEvent[] {
  return localEvents.slice(0, Math.max(1, limit));
}
