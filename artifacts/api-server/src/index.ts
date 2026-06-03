import { config as loadEnv } from "dotenv";
import { createServer } from "node:http";
import app from "./app";
import { seedDefaultUsers } from "./lib/auth/seed";
import { logger } from "./lib/logger";
import { initMqttClient } from "./lib/mqtt";
import { initRealtime } from "./lib/realtime";
import { applyMqttSensorData } from "./lib/yolobit";

loadEnv();

void seedDefaultUsers();

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

const server = createServer(app);
initRealtime(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});
