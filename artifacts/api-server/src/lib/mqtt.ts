import { randomUUID } from "node:crypto";
import mqtt, { type MqttClient } from "mqtt";
import { logger } from "./logger";

export interface SensorTopicPayload {
  temperature?: number | null;
  humidity?: number | null;
  luminosity?: number | null;
  timestamp?: string;
  source?: string;
}

interface MqttInitOptions {
  onSensorMessage?: (payload: SensorTopicPayload) => void;
}

const MQTT_URL = process.env["MQTT_URL"];
const MQTT_SENSOR_TOPIC = process.env["MQTT_SENSOR_TOPIC"] ?? "yolobit/sensor";
const MQTT_COMMAND_TOPIC = process.env["MQTT_COMMAND_TOPIC"] ?? "yolobit/command";

let client: MqttClient | null = null;
let isConnected = false;

export function initMqttClient(options: MqttInitOptions = {}): void {
  if (!MQTT_URL) {
    logger.warn("MQTT_URL is not set. MQTT pub/sub is disabled.");
    return;
  }

  if (client) {
    return;
  }

  client = mqtt.connect(MQTT_URL, {
    clientId: process.env["MQTT_CLIENT_ID"] ?? `dashboard-api-${randomUUID()}`,
    username: process.env["MQTT_USERNAME"],
    password: process.env["MQTT_PASSWORD"],
    reconnectPeriod: 2_000,
    clean: true,
  });

  client.on("connect", () => {
    isConnected = true;
    logger.info({ broker: MQTT_URL }, "Connected to MQTT broker");

    client?.subscribe(MQTT_SENSOR_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        logger.error({ err: err.message, topic: MQTT_SENSOR_TOPIC }, "MQTT subscribe failed");
        return;
      }
      logger.info({ topic: MQTT_SENSOR_TOPIC }, "Subscribed to sensor topic");
    });
  });

  client.on("message", (topic, payloadBuffer) => {
    if (topic !== MQTT_SENSOR_TOPIC) {
      return;
    }

    try {
      const payload = JSON.parse(payloadBuffer.toString()) as SensorTopicPayload;
      options.onSensorMessage?.(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parse error";
      logger.warn({ err: message, topic }, "Invalid MQTT payload");
    }
  });

  client.on("reconnect", () => {
    logger.warn("Reconnecting to MQTT broker...");
  });

  client.on("close", () => {
    isConnected = false;
    logger.warn("MQTT connection closed");
  });

  client.on("error", (error) => {
    logger.error({ err: error.message }, "MQTT client error");
  });
}

export function hasMqttConnection(): boolean {
  return isConnected;
}

export async function publishSensorPayload(payload: SensorTopicPayload): Promise<void> {
  if (!client || !isConnected) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    client?.publish(MQTT_SENSOR_TOPIC, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export async function publishCommand(command: string): Promise<void> {
  if (!client || !isConnected) {
    return;
  }

  const payload = {
    command,
    timestamp: new Date().toISOString(),
    source: "dashboard",
  };

  await new Promise<void>((resolve, reject) => {
    client?.publish(MQTT_COMMAND_TOPIC, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}
