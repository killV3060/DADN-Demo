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
const MQTT_SENSOR_TOPIC = process.env["MQTT_SENSOR_TOPIC"] ?? "yolobit/sensor/+";
const MQTT_COMMAND_TOPIC = process.env["MQTT_COMMAND_TOPIC"] ?? "yolobit/command";

console.log("MQTT Configuration:", {
  MQTT_URL,
  MQTT_SENSOR_TOPIC,
  MQTT_COMMAND_TOPIC,
});

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

  // Khởi tạo MQTT client với cấu hình kết nối và tùy chọn
  client = mqtt.connect(MQTT_URL, {
    clientId: process.env["MQTT_CLIENT_ID"] ?? `dashboard-api-${randomUUID()}`,
    username: process.env["MQTT_USERNAME"],
    password: process.env["MQTT_PASSWORD"],
    reconnectPeriod: 2_000,
    clean: true,
  });

  // Xử lý sự kiện kết nối MQTT
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

  // Xử lý tin nhắn từ topic "yolobit/sensor/+"
  client.on("message", (topic, payloadBuffer) => {
    if (!topic.startsWith("yolobit/sensor/")) {
      return;
    }

    const deviceId = topic.split("/")[2];

    try {
      const payload = JSON.parse(payloadBuffer.toString()) as SensorTopicPayload;

      options.onSensorMessage?.({
        ...payload,
        source: deviceId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown parse error";
      logger.warn({ err: message, topic }, "Invalid MQTT payload");
    }
  });

  // Xử lý sự kiện lỗi và ngắt kết nối MQTT (kết nối lại)
  client.on("reconnect", () => {
    logger.warn("Reconnecting to MQTT broker...");
  });

  // MQTT broker ngắt kết nối
  client.on("close", () => {
    isConnected = false;
    logger.warn("MQTT connection closed");
  });

  // Xử lý lỗi MQTT
  client.on("error", (error) => {
    logger.error({ err: error.message }, "MQTT client error");
  });
}

export function hasMqttConnection(): boolean {
  return isConnected;
}

export async function publishSensorPayload(deviceId: string, payload: SensorTopicPayload): Promise<void> {
  if (!client || !isConnected) {
    return;
  }

  const topic = `yolobit/sensor/${deviceId}`;

  await new Promise<void>((resolve, reject) => {
    client?.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function publishCommand(deviceId: string, command: string): Promise<void> {
  if (!client || !isConnected) {
    return;
  }

  const topic = `yolobit/command/${deviceId}`;

  const payload = {
    command,
    timestamp: new Date().toISOString(),
    source: "dashboard",
  };

  await new Promise<void>((resolve, reject) => {
    client?.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
