import { config as loadEnv } from "dotenv";
import app from "./app";
import { seedDefaultUsers } from "./lib/auth/seed";
import { logger } from "./lib/logger";
import { initMqttClient } from "./lib/mqtt";
import { applyMqttSensorData } from "./lib/yolobit";

async function startServer(): Promise<void> {
  loadEnv();

  await seedDefaultUsers();

  initMqttClient({
    onSensorMessage: applyMqttSensorData,
  });

  const rawPort = process.env["API_PORT"] ?? process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "API_PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid API_PORT value: "${rawPort}"`);
  }

  app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
}

startServer().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : "Unknown error";
  logger.fatal({ err: msg }, "Server failed to start");
  process.exit(1);
});
