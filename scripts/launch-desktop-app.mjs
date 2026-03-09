import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const electronBinary = process.platform === "win32"
  ? path.join(projectRoot, "node_modules", ".bin", "electron.cmd")
  : path.join(projectRoot, "node_modules", ".bin", "electron");

const child = spawn(
  electronBinary,
  [path.join(projectRoot, "desktop", "knobb", "main.mjs")],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      KNOBB_DESKTOP_URL: process.env.KNOBB_DESKTOP_URL || "http://127.0.0.1:5173",
    },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
