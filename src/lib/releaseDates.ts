const ISO_DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

function normalizeFallbackYear(fallbackYear?: number | null) {
  if (typeof fallbackYear !== "number" || !Number.isFinite(fallbackYear) || fallbackYear <= 0) {
    return 0;
  }

  return Math.trunc(fallbackYear);
}

export function getReleaseYear(releaseDate?: string | null, fallbackYear?: number | null) {
  if (typeof releaseDate === "string") {
    const normalized = releaseDate.trim();
    const isoMatch = normalized.match(ISO_DATE_PATTERN);
    if (isoMatch) {
      return Number.parseInt(isoMatch[1] || "0", 10) || normalizeFallbackYear(fallbackYear);
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getUTCFullYear();
    }
  }

  return normalizeFallbackYear(fallbackYear);
}

export function formatReleaseDate(releaseDate?: string | null, fallbackYear?: number | null, locale = "en-US") {
  if (typeof releaseDate === "string") {
    const normalized = releaseDate.trim();
    const isoMatch = normalized.match(ISO_DATE_PATTERN);

    if (isoMatch) {
      const year = Number.parseInt(isoMatch[1] || "0", 10);
      const month = Number.parseInt(isoMatch[2] || "1", 10);
      const day = Number.parseInt(isoMatch[3] || "1", 10);

      if (year > 0 && isoMatch[2] && isoMatch[3]) {
        return new Intl.DateTimeFormat(locale, {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(year, month - 1, day)));
      }

      if (year > 0 && isoMatch[2]) {
        return new Intl.DateTimeFormat(locale, {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(year, month - 1, 1)));
      }

      if (year > 0) {
        return String(year);
      }
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat(locale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(parsed);
    }
  }

  const year = normalizeFallbackYear(fallbackYear);
  return year > 0 ? String(year) : "Unknown";
}
