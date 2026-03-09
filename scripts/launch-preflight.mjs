#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envFiles = [".env.local", ".env"];

function readEnvFile(path) {
  if (!existsSync(path)) return new Map();

  const raw = readFileSync(path, "utf8");
  const map = new Map();

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    map.set(key, value);
  }

  return map;
}

const dotEnvSources = envFiles.map((file) => ({
  file,
  values: readEnvFile(resolve(root, file)),
}));

function checkFile(path) {
  const abs = resolve(root, path);
  return existsSync(abs);
}

function checkEnvVar(name) {
  const runtimeValue = process.env[name];
  if (runtimeValue && String(runtimeValue).trim()) {
    return { ok: true, source: "process environment" };
  }

  for (const { file, values } of dotEnvSources) {
    const fileValue = values.get(name);
    if (fileValue && String(fileValue).trim()) {
      return { ok: true, source: file };
    }
  }

  return { ok: false, source: `.env.local or .env` };
}

function printResult(label, ok, detail = "") {
  const status = ok ? "OK" : "MISSING";
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`[${status}] ${label}${suffix}`);
}

console.log("Knobb launch preflight\n");

printResult("Knobb music core client", checkFile("src/lib/musicCore.ts"));
printResult("Music API adapter", checkFile("src/lib/musicApi.ts"));
printResult("Architecture doc", checkFile("docs/architecture.md"));
printResult("Account deletion function", checkFile("supabase/functions/delete-account/index.ts"));
printResult("Notifications migration", checkFile("supabase/migrations/20260304222000_notifications_backend.sql"));
printResult("Sharing migration", checkFile("supabase/migrations/20260304224000_playlist_visibility_and_share_links.sql"));
printResult("Listening pipeline migration", checkFile("supabase/migrations/20260304213000_listening_intelligence_pipeline.sql"));
printResult("Observability migration", checkFile("supabase/migrations/20260304230000_observability_events.sql"));
printResult("Legal pages", checkFile("src/pages/PrivacyPage.tsx") && checkFile("src/pages/TermsPage.tsx") && checkFile("src/pages/CookiesPage.tsx"));
printResult("Netlify config", checkFile("netlify.toml") && checkFile("public/_redirects"));

const supabaseUrlEnv = checkEnvVar("VITE_SUPABASE_URL");
printResult("VITE_SUPABASE_URL env", supabaseUrlEnv.ok, supabaseUrlEnv.source);
const supabasePublishableKeyEnv = checkEnvVar("VITE_SUPABASE_PUBLISHABLE_KEY");
printResult(
  "VITE_SUPABASE_PUBLISHABLE_KEY env",
  supabasePublishableKeyEnv.ok,
  supabasePublishableKeyEnv.source,
);
printResult("Launch readiness doc", checkFile("docs/launch-readiness.md"));
printResult("Reference integration doc", checkFile("docs/tidal-v2-integration.md"));

const pkgPath = resolve(root, "package.json");
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  printResult("Build script exists", Boolean(pkg?.scripts?.build));
  printResult("Test script exists", Boolean(pkg?.scripts?.test));
}

console.log("\nNext required manual checks:");
console.log("1) Run: npm run test && npm run build");
console.log("2) Apply Supabase migrations in target env");
console.log("3) Configure Supabase Auth + Google redirect URLs");
console.log("4) Verify music playback against your intended instance pool");
console.log("5) Run live smoke tests before broader promotion");
