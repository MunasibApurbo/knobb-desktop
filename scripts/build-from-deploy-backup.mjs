import { cp, mkdir, rm, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(rootDir, "deploy-backup-site");
const distDir = path.join(rootDir, "dist");

async function main() {
  try {
    await stat(sourceDir);
  } catch {
    console.error(`Missing recovered deploy bundle at ${sourceDir}`);
    process.exitCode = 1;
    return;
  }

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(sourceDir, distDir, { recursive: true });

  console.log(`Copied recovered deploy bundle from ${path.relative(rootDir, sourceDir)} to dist/`);
}

main().catch((error) => {
  console.error("Failed to build from recovered deploy bundle.", error);
  process.exitCode = 1;
});
