// yolobit.ts - Model: handles Yolobit device connection and data parsing
import { SerialPort } from "serialport";
import { logger } from "./logger";
import { saveCommandLog, saveSensorReading } from "./db";
import {
  hasMqttConnection,
  publishCommand,
  publishSensorPayload,
  type SensorTopicPayload,
} from "./mqtt";

// Sensor data state (in-memory, updated by serial reader)
interface SensorState {
  temperature: number | null;
  humidity: number | null;
  luminosity: number | null;
  timestamp: string | null;
  tempMax: number;
  humidMin: number;
}

interface SensorSnapshot {
  temperature: number | null;
  humidity: number | null;
  luminosity: number | null;
  timestamp: string | null;
}

interface SensorReadingInput {
  source: string;
  temperature: number | null;
  humidity: number | null;
  luminosity: number | null;
  timestamp?: string | null;
  rawPayload?: Record<string, unknown> | null;
}

const state: SensorState = {
  temperature: null,
  humidity: null,
  luminosity: null,
  timestamp: null,
  tempMax: 35,
  humidMin: 30,
};

let port: SerialPort | null = null;
let connectedPort: string | null = null;
let connectionMode: string | null = null;
let demoInterval: ReturnType<typeof setInterval> | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
const latestSensorReadings = new Map<string, SensorSnapshot>();
let latestSensorSource: string | null = null;
const intentionalClosePorts = new WeakSet<SerialPort>();

function toSensorPayload(source: string, snapshot: SensorSnapshot = state): SensorTopicPayload {
  return {
    temperature: snapshot.temperature,
    humidity: snapshot.humidity,
    luminosity: snapshot.luminosity,
    timestamp: snapshot.timestamp ?? new Date().toISOString(),
    source,
  };
}

function getWarningsForSnapshot(snapshot: SensorSnapshot) {
  return {
    temperatureHigh: snapshot.temperature !== null && snapshot.temperature > state.tempMax,
    humidityLow: snapshot.humidity !== null && snapshot.humidity < state.humidMin,
  };
}

function cacheSnapshot(source: string, snapshot: SensorSnapshot): void {
  latestSensorReadings.set(source, snapshot);
  latestSensorSource = source;
}

async function persistSensorReading(input: SensorReadingInput): Promise<void> {
  const snapshot: SensorSnapshot = {
    temperature: input.temperature,
    humidity: input.humidity,
    luminosity: input.luminosity,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };

  state.temperature = snapshot.temperature;
  state.humidity = snapshot.humidity;
  state.luminosity = snapshot.luminosity;
  state.timestamp = snapshot.timestamp;

  cacheSnapshot(input.source, snapshot);

  const payload = toSensorPayload(input.source, snapshot);
  await saveSensorReading({
    source: input.source,
    temperature: payload.temperature ?? null,
    humidity: payload.humidity ?? null,
    luminosity: payload.luminosity ?? null,
    timestamp: payload.timestamp,
    rawPayload: input.rawPayload ?? (payload as Record<string, unknown>),
  });
}

async function onSensorUpdated(source: string): Promise<void> {
  try {
    await persistSensorReading({
      source,
      temperature: state.temperature,
      humidity: state.humidity,
      luminosity: state.luminosity,
      timestamp: state.timestamp,
      rawPayload: toSensorPayload(source, state) as Record<string, unknown>,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DB error";
    logger.warn({ err: message }, "Could not persist sensor data");
  }

  try {
    await publishSensorPayload(source, toSensorPayload(source, state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MQTT error";
    logger.warn({ err: message }, "Could not publish sensor payload");
  }
}

// Parse Yolobit data format: !1:T:xx#!1:H:yy#!1:L:zz#
function parseYolobitData(raw: string): void {
  const tempMatch = raw.match(/!1:T:([\d.]+)#/);
  const humidMatch = raw.match(/!1:H:([\d.]+)#/);
  const lumiMatch = raw.match(/!1:L:([\d.]+)#/);

  if (tempMatch) state.temperature = parseFloat(tempMatch[1]);
  if (humidMatch) state.humidity = parseFloat(humidMatch[1]);
  if (lumiMatch) state.luminosity = parseFloat(lumiMatch[1]);

  if (tempMatch || humidMatch || lumiMatch) {
    state.timestamp = new Date().toISOString();
    logger.debug({ temp: state.temperature, humid: state.humidity, lumi: state.luminosity }, "Sensor data updated");
    void onSensorUpdated("serial");
  }
}

export function applyMqttSensorData(payload: SensorTopicPayload): void {
  logger.info({ payload }, "applyMqttSensorData called");

  const hasValue =
    typeof payload.temperature === "number" ||
    typeof payload.humidity === "number" ||
    typeof payload.luminosity === "number";

  logger.debug({ temperature: typeof payload.temperature, humidity: typeof payload.humidity, luminosity: typeof payload.luminosity, hasValue }, "Type check");

  if (!hasValue) {
    logger.warn({ payload }, "No numeric values in MQTT payload, skipping");
    return;
  }

  if (typeof payload.temperature === "number") {
    state.temperature = payload.temperature;
  }
  if (typeof payload.humidity === "number") {
    state.humidity = payload.humidity;
  }
  if (typeof payload.luminosity === "number") {
    state.luminosity = payload.luminosity;
  }

  state.timestamp = payload.timestamp ?? new Date().toISOString();

  const source = payload.source ?? "mqtt";

  logger.info({ source, temperature: state.temperature, humidity: state.humidity, luminosity: state.luminosity }, "Persisting MQTT sensor data");

  void persistSensorReading({
    source,
    temperature: state.temperature,
    humidity: state.humidity,
    luminosity: state.luminosity,
    timestamp: state.timestamp,
    rawPayload: payload as Record<string, unknown>,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown DB error";
    logger.warn({ err: message }, "Could not persist MQTT sensor payload");
  });
}

// Connect to device via serial port (USB)
export async function connectSerial(portPath: string): Promise<void> {
  // Disconnect existing connection first
  await disconnect();

  return new Promise((resolve, reject) => {
    const sp = new SerialPort({
      path: portPath,
      baudRate: 115200,
      autoOpen: false,
    });

    sp.open((err) => {
      if (err) {
        const lower = err.message.toLowerCase();
        if (lower.includes("access denied") || lower.includes("permission")) {
          reject(
            new Error(
              `Cannot open port ${portPath}: ${err.message}. Port may be busy (Serial Monitor/another app is using it).`
            )
          );
          return;
        }
        reject(new Error(`Cannot open port ${portPath}: ${err.message}`));
        return;
      }

      port = sp;
      connectedPort = portPath;
      connectionMode = "serial";
      logger.info({ portPath }, "Connected to Yolobit via serial");

      let buffer = "";
      sp.on("data", (data: Buffer) => {
        buffer += data.toString();
        // Parse complete packets (ends with #)
        if (buffer.includes("#")) {
          parseYolobitData(buffer);
          buffer = "";
        }
      });

      sp.on("close", () => {
        if (intentionalClosePorts.has(sp)) {
          intentionalClosePorts.delete(sp);
          logger.info({ portPath }, "Serial port closed intentionally");
          return;
        }

        logger.warn("Serial port closed, attempting reconnect...");
        port = null;
        // Auto-reconnect after 3 seconds
        reconnectTimeout = setTimeout(() => {
          connectSerial(portPath).catch((e) => {
            logger.error({ err: e.message }, "Reconnect failed");
          });
        }, 3000);
      });

      sp.on("error", (e) => {
        logger.error({ err: e.message }, "Serial port error");
      });

      resolve();
    });
  });
}

// Start demo mode with simulated data (async so connection status is set before response)
export async function startDemoMode(): Promise<void> {
  await disconnect();

  connectionMode = "demo";
  connectedPort = "demo";

  let t = 28;
  let h = 55;
  let l = 60;

  // Set initial values immediately
  state.temperature = t;
  state.humidity = h;
  state.luminosity = l;
  state.timestamp = new Date().toISOString();

  demoInterval = setInterval(() => {
    // Simulate small fluctuations
    t = Math.round((t + (Math.random() - 0.5) * 2) * 10) / 10;
    h = Math.round((h + (Math.random() - 0.5) * 3) * 10) / 10;
    l = Math.round((l + (Math.random() - 0.5) * 10) * 10) / 10;

    // Keep in realistic range
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

// Disconnect from device
export async function disconnect(): Promise<void> {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (port && port.isOpen) {
    return new Promise((resolve) => {
      intentionalClosePorts.add(port!);
      port!.close(() => {
        port = null;
        connectedPort = null;
        connectionMode = null;
        resolve();
      });
    });
  }
  port = null;
  connectedPort = null;
  connectionMode = null;
}

// Send a command to the device (1-10 as a string)
export async function sendCommand(cmd: string): Promise<void> {
  let publishedToMqtt = false;

  try {
    await publishCommand(connectedPort ?? "dashboard", cmd);
    publishedToMqtt = hasMqttConnection();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MQTT error";
    logger.warn({ cmd, err: message }, "MQTT publish failed");
  }

  if (connectionMode === "demo") {
    logger.info({ cmd }, "Demo mode: command simulated");
    await saveCommandLog({
      command: cmd,
      source: "dashboard",
      status: publishedToMqtt ? "published" : "accepted",
      detail: "Demo mode command",
    });
    return;
  }

  if (!port || !port.isOpen) {
    if (publishedToMqtt) {
      logger.info({ cmd }, "Command published to MQTT while serial is disconnected");
      await saveCommandLog({
        command: cmd,
        source: "dashboard",
        status: "published",
        detail: "Published to MQTT only",
      });
      return;
    }
    await saveCommandLog({
      command: cmd,
      source: "dashboard",
      status: "failed",
      detail: "Device not connected",
    });
    throw new Error("Device not connected");
  }

  return new Promise((resolve, reject) => {
    port!.write(cmd, (err) => {
      if (err) {
        void saveCommandLog({
          command: cmd,
          source: "serial",
          status: "failed",
          detail: err.message,
        });
        reject(new Error(`Write error: ${err.message}`));
      } else {
        void saveCommandLog({
          command: cmd,
          source: "serial",
          status: publishedToMqtt ? "published" : "accepted",
          detail: publishedToMqtt ? "Serial + MQTT" : "Serial only",
        });
        resolve();
      }
    });
  });
}

// Get available serial ports (gracefully handle environments without udevadm)
export async function getAvailablePorts(): Promise<string[]> {
  try {
    const ports = await SerialPort.list();
    return ports.map((p) => p.path);
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "Could not enumerate serial ports");
    return [];
  }
}

// Get current sensor data with warning flags
export function getSensorData() {
  const snapshot = latestSensorSource ? latestSensorReadings.get(latestSensorSource) : null;
  const sourceSnapshot = snapshot ?? {
    temperature: state.temperature,
    humidity: state.humidity,
    luminosity: state.luminosity,
    timestamp: state.timestamp,
  };

  return {
    temperature: sourceSnapshot.temperature,
    humidity: sourceSnapshot.humidity,
    luminosity: sourceSnapshot.luminosity,
    timestamp: sourceSnapshot.timestamp,
    warnings: getWarningsForSnapshot(sourceSnapshot),
  };
}

export function getSensorDataForSource(source: string) {
  const snapshot = latestSensorReadings.get(source);

  if (!snapshot) {
    return null;
  }

  return {
    temperature: snapshot.temperature,
    humidity: snapshot.humidity,
    luminosity: snapshot.luminosity,
    timestamp: snapshot.timestamp,
    warnings: getWarningsForSnapshot(snapshot),
  };
}

export async function ingestSensorReading(input: SensorReadingInput): Promise<void> {
  await persistSensorReading(input);
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
  return {
    connected: connectionMode !== null,
    port: connectedPort,
    mode: connectionMode,
  };
}
