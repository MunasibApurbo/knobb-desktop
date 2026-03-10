#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function file(path) {
  return resolve(root, path);
}

function exists(path) {
  return existsSync(file(path));
}

function read(path) {
  return readFileSync(file(path), "utf8");
}

function printResult(ok, label, detail = "") {
  const status = ok ? "OK" : "MISSING";
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`[${status}] ${label}${suffix}`);
}

function listFiles(path) {
  if (!exists(path)) return [];
  return readdirSync(file(path)).sort();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function compareFiles(leftPath, rightPath) {
  if (!exists(leftPath) || !exists(rightPath)) return false;
  return read(leftPath) === read(rightPath);
}

console.log("Knobb deploy report\n");

const buildFiles = [
  "dist/index.html",
  "dist/404.html",
  "dist/_redirects",
  "dist/_headers",
  "dist/site.webmanifest",
  "dist/sw.js",
];

for (const buildFile of buildFiles) {
  printResult(exists(buildFile), buildFile.replace(/^dist\//, "Built asset: "));
}

printResult(
  compareFiles("public/_redirects", "dist/_redirects"),
  "Built redirects match source",
);
printResult(
  compareFiles("public/_headers", "dist/_headers"),
  "Built headers match source",
);

const indexPath = file("dist/index.html");
if (existsSync(indexPath)) {
  const indexHtml = readFileSync(indexPath, "utf8");
  printResult(indexHtml.includes('<div id="root"></div>'), "Built app root marker");
}

const netlifyFunctions = listFiles("netlify/functions").filter((name) => name.endsWith(".js"));
printResult(netlifyFunctions.length > 0, "Netlify functions present", `${netlifyFunctions.length} function(s)`);
for (const fn of netlifyFunctions) {
  console.log(`  - netlify/functions/${fn}`);
}

const supabaseFunctions = listFiles("supabase/functions").filter((name) => !name.startsWith("."));
printResult(supabaseFunctions.length > 0, "Supabase functions present", `${supabaseFunctions.length} function folder(s)`);
for (const fn of supabaseFunctions) {
  console.log(`  - supabase/functions/${fn}`);
}

const migrations = listFiles("supabase/migrations").filter((name) => name.endsWith(".sql"));
printResult(migrations.length > 0, "Supabase migrations present", `${migrations.length} migration(s)`);
if (migrations.length > 0) {
  const latest = migrations[migrations.length - 1];
  console.log(`  Latest migration: ${latest}`);
}

if (exists("dist/assets")) {
  const assetFiles = readdirSync(file("dist/assets")).map((name) => ({
    name,
    size: statSync(file(`dist/assets/${name}`)).size,
  }));
  const largestAssets = assetFiles
    .sort((left, right) => right.size - left.size)
    .slice(0, 5);
  console.log("\nLargest built assets:");
  for (const asset of largestAssets) {
    console.log(`  - ${asset.name}: ${formatBytes(asset.size)}`);
  }
}

console.log("\nExternal deploy inputs still required:");
console.log("1) GitHub repository variables for VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");
console.log("2) GitHub secrets for NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID, SUPABASE_ACCESS_TOKEN, and SUPABASE_DB_PASSWORD");
console.log("3) Netlify environment values matching the production frontend config");
console.log("4) Supabase Auth redirect URLs and Google OAuth settings");
console.log("5) Apple and optional Windows signing secrets if desktop release publishing should be fully automated");
console.log("6) Live smoke test on the deployed site and latest desktop release");
