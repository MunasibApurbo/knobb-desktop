import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildMacUpdateFeed, readJson } from "./mac-update-feed.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultOutputPath = path.join(projectRoot, "release", "desktop", "releases.json");
const defaultZipPath = path.join(projectRoot, "release", "desktop", "Knobb-Desktop-macOS.zip");

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

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readPackageVersion() {
  const packageJson = await readJson(path.join(projectRoot, "package.json"));
  return String(packageJson?.version || "").trim();
}

async function readReleaseNotes(options) {
  if (options["notes-file"]) {
    return (await fs.readFile(path.resolve(projectRoot, options["notes-file"]), "utf8")).trim();
  }

  if (options.notes) {
    return String(options.notes).trim();
  }

  return `Knobb Desktop ${await readPackageVersion()}`;
}

function resolveOutputPath(options) {
  return path.resolve(projectRoot, options.output || defaultOutputPath);
}

function resolveZipUrl(options) {
  return String(options.url || process.env.KNOBB_MAC_UPDATE_ZIP_URL || "").trim();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const appVersion = await readPackageVersion();
  if (!appVersion || appVersion === "0.0.0") {
    fail("package.json version must be set to a real release version before generating a mac update feed.");
  }

  if (!await exists(defaultZipPath)) {
    fail(`Expected packaged zip at ${defaultZipPath}. Run \`npm run desktop:package\` first.`);
  }

  const zipUrl = resolveZipUrl(options);
  if (!zipUrl) {
    fail("Provide the hosted ZIP URL with --url or KNOBB_MAC_UPDATE_ZIP_URL.");
  }

  const outputPath = resolveOutputPath(options);
  const notes = await readReleaseNotes(options);
  const pubDate = String(options["pub-date"] || new Date().toISOString()).trim();
  await buildMacUpdateFeed({
    appVersion,
    notes,
    outputPath,
    pubDate,
    zipUrl,
  });

  console.log(`Wrote ${outputPath}`);
  console.log(`Current release: ${appVersion}`);
  console.log(`ZIP URL: ${zipUrl}`);
}

void main().catch((error) => {
  console.error("Failed to build the mac update feed", error);
  process.exit(1);
});
