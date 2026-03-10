import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const supabaseDir = path.join(projectRoot, "supabase");
const supabaseConfigPath = path.join(supabaseDir, "config.toml");
const supabaseFunctionsDir = path.join(supabaseDir, "functions");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...extraEnv,
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed (${command} ${args.join(" ")}), code=${code ?? "null"}, signal=${signal ?? "none"}`));
    });
  });
}

function runNpx(args, extraEnv = {}) {
  return run("npx", ["--yes", ...args], extraEnv);
}

async function readProjectRef() {
  const source = await fs.readFile(supabaseConfigPath, "utf8");
  const match = source.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  if (!match?.[1]) {
    fail(`Could not read project_id from ${supabaseConfigPath}`);
  }

  return match[1].trim();
}

async function listFunctionNames() {
  const entries = await fs.readdir(supabaseFunctionsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function main() {
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const dbPassword = String(process.env.SUPABASE_DB_PASSWORD || "").trim();

  if (!accessToken) {
    fail("SUPABASE_ACCESS_TOKEN is required.");
  }

  if (!dbPassword) {
    fail("SUPABASE_DB_PASSWORD is required.");
  }

  const projectRef = String(process.env.SUPABASE_PROJECT_REF || "").trim() || await readProjectRef();
  const functionNames = await listFunctionNames();

  console.log(`Deploying Supabase project: ${projectRef}`);

  await runNpx(["supabase", "link", "--project-ref", projectRef, "--password", dbPassword], {
    SUPABASE_ACCESS_TOKEN: accessToken,
    SUPABASE_DB_PASSWORD: dbPassword,
  });

  await runNpx(["supabase", "db", "push", "--include-all"], {
    SUPABASE_ACCESS_TOKEN: accessToken,
    SUPABASE_DB_PASSWORD: dbPassword,
  });

  for (const functionName of functionNames) {
    console.log(`Deploying Supabase function: ${functionName}`);
    await runNpx(["supabase", "functions", "deploy", functionName, "--project-ref", projectRef], {
      SUPABASE_ACCESS_TOKEN: accessToken,
    });
  }

  console.log("Supabase deployment complete.");
}

void main().catch((error) => {
  console.error("Supabase deployment failed.", error);
  process.exit(1);
});
