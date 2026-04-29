// yolobit.ts - Model: handles Yolobit device state and command dispatch
// v2: MQTT-only transport (no USB Serial). Data arrives via MQTT subscription
// (see mqtt.ts). Demo mode generates simulated readings locally.

import { logger } from "./logger";
import { saveCommandLog, saveSensorReading } from "./db";
import {
  hasMqttConnection,
  publishCommand,
  publishSensorPayload,
  type SensorTopicPayload,
} from "./mqtt";

const DEVICE_ID = process.env["DEVICE_ID"] ?? "1";

interface SensorState {
  temperature: number | null;
  humidity: number | null;
  luminosity: number | null;
  timestamp: string | null;
  tempMax: number;
  humidMin: number;
}

const state: SensorState = {
  temperature: null,
  humidity: null,
  luminosity: null,
  timestamp: null,
  tempMax: 35,
  humidMin: 30,
};

let connectionMode: "mqtt" | "demo" | null = null;
let demoInterval: ReturnType<typeof setInterval> | null = null;

function toSensorPayload(source: "demo" | "mqtt"): SensorTopicPayload {
  return {
    temperature: state.temperature,
    humidity: state.humidity,
    luminosity: state.luminosity,
    timestamp: state.timestamp ?? new Date().toISOString(),
    source,
  };
}

async function persistSensor(source: "demo" | "mqtt"): Promise<void> {
  const payload = toSensorPayload(source);
  await saveSensorReading({
    source,
    temperature: payload.temperature ?? null,
    humidity: payload.humidity ?? null,
    luminosity: payload.luminosity ?? null,
    timestamp: payload.timestamp,
    rawPayload: payload as Record<string, unknown>,
  });
}

async function onSensorUpdated(source: "demo" | "mqtt"): Promise<void> {
  try {
    await persistSensor(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DB error";
    logger.warn({ err: message }, "Could not persist sensor data");
  }

  if (source === "demo") {
    try {
      await publishSensorPayload(DEVICE_ID, toSensorPayload(source));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown MQTT error";
      logger.warn({ err: message }, "Could not publish demo sensor payload");
    }
  }
}

// Called by mqtt.ts when a sensor message arrives on yolobit/sensor/+
export function applyMqttSensorData(payload: SensorTopicPayload): void {
  const hasValue =
    typeof payload.temperature === "number" ||
    typeof payload.humidity === "number" ||
    typeof payload.luminosity === "number";

  if (!hasValue) {
    return;
  }

  if (typeof payload.temperature === "number") state.temperature = payload.temperature;
  if (typeof payload.humidity === "number") state.humidity = payload.humidity;
  if (typeof payload.luminosity === "number") state.luminosity = payload.luminosity;

  state.timestamp = payload.timestamp ?? new Date().toISOString();

  if (connectionMode === null) {
    connectionMode = "mqtt";
    logger.info("MQTT sensor data received — connection mode set to mqtt");
  }

  void persistSensor("mqtt").catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown DB error";
    logger.warn({ err: message }, "Could not persist MQTT sensor payload");
  });
}

// Switch to MQTT mode (real device data via broker subscription)
export function connectMqtt(): void {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
  connectionMode = "mqtt";
  logger.info({ deviceId: DEVICE_ID }, "Connection mode set to MQTT");
}

// Start demo mode with simulated data
export async function startDemoMode(): Promise<void> {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }

  connectionMode = "demo";

  let t = 28;
  let h = 55;
  let l = 60;

  state.temperature = t;
  state.humidity = h;
  state.luminosity = l;
  state.timestamp = new Date().toISOString();

  demoInterval = setInterval(() => {
    t = Math.round((t + (Math.random() - 0.5) * 2) * 10) / 10;
    h = Math.round((h + (Math.random() - 0.5) * 3) * 10) / 10;
    l = Math.round((l + (Math.random() - 0.5) * 10) * 10) / 10;

    t = Math.max(20, Math.min(45, t));
    h = Math.max(20, Math.min(90, h));
    l = Math.max(0, Math.min(100, l));

    state.temperature = t;
    state.humidity = h;
    state.luminosity = l;
    state.timestamp = new Date().toISOString();
    void onSensorUpdated("demo");
  }, 1000);

  logger.info("Demo mode started");
}

// Disconnect (stop demo, revert to idle)
export async function disconnect(): Promise<void> {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
  connectionMode = null;
  logger.info("Disconnected");
}

function logCommand(input: Parameters<typeof saveCommandLog>[0]): void {
  saveCommandLog(input).catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown DB error";
    logger.warn({ cmd: input.command, err: message }, "Could not persist command log");
  });
}

// Send a command to the device via MQTT
export async function sendCommand(cmd: string): Promise<void> {
  const mqttAvailable = hasMqttConnection();

  if (connectionMode === "demo") {
    logger.info({ cmd }, "Demo mode: command simulated");
    logCommand({
      command: cmd,
      source: "dashboard",
      status: mqttAvailable ? "published" : "accepted",
      detail: mqttAvailable ? "Demo + MQTT published" : "Demo mode command",
    });
    if (mqttAvailable) {
      await publishCommand(DEVICE_ID, cmd).catch(() => undefined);
    }
    return;
  }

  if (!mqttAvailable) {
    logCommand({
      command: cmd,
      source: "dashboard",
      status: "failed",
      detail: "MQTT not connected",
    });
    throw new Error("MQTT broker not connected");
  }

  await publishCommand(DEVICE_ID, cmd);
  logCommand({
    command: cmd,
    source: "dashboard",
    status: "published",
    detail: `Published to yolobit/command/${DEVICE_ID}`,
  });
}

// Get current sensor data
export function getSensorData() {
  return {
    temperature: state.temperature,
    humidity: state.humidity,
    luminosity: state.luminosity,
    timestamp: state.timestamp,
    warnings: {
      temperatureHigh: state.temperature !== null && state.temperature > state.tempMax,
      humidityLow: state.humidity !== null && state.humidity < state.humidMin,
    },
  };
}

// Get/set thresholds
export function getThresholds() {
  return { tempMax: state.tempMax, humidMin: state.humidMin };
}

export function setThresholds(tempMax: number, humidMin: number) {
  state.tempMax = tempMax;
  state.humidMin = humidMin;
  return { tempMax: state.tempMax, humidMin: state.humidMin };
}

// Get connection status
export function getConnectionStatus() {
  const brokerUrl = process.env["MQTT_URL"] ?? null;
  return {
    connected: connectionMode !== null,
    port: connectionMode === "mqtt" ? (brokerUrl ?? "mqtt") : connectionMode,
    mode: connectionMode,
  };
}
