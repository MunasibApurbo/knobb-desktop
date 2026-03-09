import fs from "node:fs/promises";
import path from "node:path";

export const MAC_UPDATE_ZIP_NAME = "Knobb-Desktop-macOS.zip";

export function compareReleaseVersions(left, right) {
  const leftParts = String(left || "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

export async function readJson(targetPath, fallback) {
  try {
    const source = await fs.readFile(targetPath, "utf8");
    return JSON.parse(source);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export function inferMacUpdateZipUrl(feedUrl) {
  const normalized = String(feedUrl || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    const pathname = url.pathname;
    if (!pathname.endsWith("/releases.json")) {
      return null;
    }

    url.pathname = pathname.replace(/\/releases\.json$/, `/${MAC_UPDATE_ZIP_NAME}`);
    return url.toString();
  } catch {
    return null;
  }
}

export async function buildMacUpdateFeed({
  appVersion,
  notes,
  outputPath,
  pubDate,
  zipUrl,
}) {
  const existingFeed = await readJson(outputPath, { currentRelease: appVersion, releases: [] });
  const releases = Array.isArray(existingFeed?.releases) ? existingFeed.releases : [];

  const nextRelease = {
    version: appVersion,
    updateTo: {
      version: appVersion,
      pub_date: pubDate,
      notes,
      name: `Knobb Desktop ${appVersion}`,
      url: zipUrl,
    },
  };

  const filteredReleases = releases.filter((release) => release?.version !== appVersion);
  filteredReleases.push(nextRelease);
  filteredReleases.sort((left, right) => String(left.version).localeCompare(String(right.version), undefined, {
    numeric: true,
    sensitivity: "base",
  }));

  const feed = {
    currentRelease: appVersion,
    releases: filteredReleases,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`);

  return {
    outputPath,
    zipUrl,
  };
}
