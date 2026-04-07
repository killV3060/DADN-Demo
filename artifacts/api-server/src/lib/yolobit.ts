// yolobit.ts - Model: handles Yolobit device connection and data parsing
import { SerialPort } from "serialport";
import { logger } from "./logger";

// Sensor data state (in-memory, updated by serial reader)
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

let port: SerialPort | null = null;
let connectedPort: string | null = null;
let connectionMode: string | null = null;
let demoInterval: ReturnType<typeof setInterval> | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
const intentionalClosePorts = new WeakSet<SerialPort>();

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
  }
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
  if (connectionMode === "demo") {
    logger.info({ cmd }, "Demo mode: command simulated");
    return;
  }
  if (!port || !port.isOpen) {
    throw new Error("Device not connected");
  }
  return new Promise((resolve, reject) => {
    port!.write(cmd, (err) => {
      if (err) reject(new Error(`Write error: ${err.message}`));
      else resolve();
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
  return {
    connected: connectionMode !== null,
    port: connectedPort,
    mode: connectionMode,
  };
}
