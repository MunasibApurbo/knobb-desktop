import process from "node:process";

import {
  BRIDGE_VERSION,
  createBridgeService,
  loadBridgeConfig,
  printBridgeHelp,
} from "./discord-presence-bridge-core.mjs";

async function main() {
  if (process.argv.includes("--help")) {
    printBridgeHelp();
    return;
  }

  const config = await loadBridgeConfig();

  if (process.argv.includes("--check")) {
    console.log(JSON.stringify({
      configured: Boolean(config.clientId),
      port: config.port,
      appName: config.appName,
      bridgeVersion: BRIDGE_VERSION,
    }, null, 2));
    return;
  }

  const service = await createBridgeService({ config });
  await service.start();

  console.log(`Knobb Discord bridge listening on http://127.0.0.1:${config.port}`);
  if (!config.clientId) {
    console.log("Add a Discord application client ID to start publishing Rich Presence.");
  }

  const shutdown = async () => {
    await service.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main();
