import { differenceInCalendarDays } from "date-fns";

const absoluteFormatterCache = new Map<string, Intl.DateTimeFormat>();
const relativeFormatterCache = new Map<string, Intl.RelativeTimeFormat>();

function getAbsoluteFormatter(locale: string) {
  const cached = absoluteFormatterCache.get(locale);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  absoluteFormatterCache.set(locale, formatter);
  return formatter;
}

function getRelativeFormatter(locale: string) {
  const cached = relativeFormatterCache.get(locale);
  if (cached) return cached;

  const formatter = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  });
  relativeFormatterCache.set(locale, formatter);
  return formatter;
}

export function getTrackAddedAtLocale(language: string) {
  return language === "bn" ? "bn-BD" : "en-US";
}

export function formatTrackAddedAt(
  value: string | null | undefined,
  locale: string,
) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const dayDiff = differenceInCalendarDays(now, date);

  if (dayDiff < 0) {
    return getAbsoluteFormatter(locale).format(date);
  }

  if (dayDiff < 7) {
    return getRelativeFormatter(locale).format(-dayDiff, "day");
  }

  if (dayDiff < 28) {
    return getRelativeFormatter(locale).format(-Math.floor(dayDiff / 7), "week");
  }

  return getAbsoluteFormatter(locale).format(date);
}

export function formatTrackAddedAtTooltip(
  value: string | null | undefined,
  locale: string,
) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
