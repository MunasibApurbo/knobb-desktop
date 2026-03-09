import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { compareReleaseVersions, readJson } from "./mac-update-feed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const packageLockPath = path.join(projectRoot, "package-lock.json");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      fail(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      fail(`Missing value for --${key}`);
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function parseSemver(version) {
  const match = String(version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    fail(`Expected a semantic version like 0.1.1, received: ${version}`);
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(currentVersion, bump) {
  const parsed = parseSemver(currentVersion);

  if (bump === "major") {
    return formatSemver({ major: parsed.major + 1, minor: 0, patch: 0 });
  }

  if (bump === "minor") {
    return formatSemver({ major: parsed.major, minor: parsed.minor + 1, patch: 0 });
  }

  if (bump === "patch") {
    return formatSemver({ major: parsed.major, minor: parsed.minor, patch: parsed.patch + 1 });
  }

  fail(`Unsupported bump target: ${bump}`);
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const packageJson = await readJson(packageJsonPath);
  const currentVersion = String(packageJson?.version || "").trim();
  if (!currentVersion) {
    fail("package.json is missing a version.");
  }

  const nextVersion = options.version
    ? formatSemver(parseSemver(options.version))
    : bumpVersion(currentVersion, String(options.bump || "patch").trim());

  if (compareReleaseVersions(nextVersion, currentVersion) <= 0) {
    fail(`Next version (${nextVersion}) must be newer than the current package.json version (${currentVersion}).`);
  }

  packageJson.version = nextVersion;
  await writeJson(packageJsonPath, packageJson);

  const packageLock = await readJson(packageLockPath, null);
  if (packageLock) {
    packageLock.version = nextVersion;
    if (packageLock.packages?.[""]) {
      packageLock.packages[""].version = nextVersion;
    }
    await writeJson(packageLockPath, packageLock);
  }

  console.log(`Updated desktop release version: ${currentVersion} -> ${nextVersion}`);
  console.log("Next steps:");
  console.log("1. Commit package.json and package-lock.json");
  console.log(`2. Push a matching git tag like v${nextVersion}`);
  console.log("3. GitHub Actions publishes the signed Knobb Desktop installers");
  console.log("4. GitHub Actions uploads the Discord Companion installers to the same release");
}

void main().catch((error) => {
  console.error("Failed to prepare the desktop release", error);
  process.exit(1);
});
