// iot.ts - Controller: Express routes for IoT API
import { Router, type IRouter } from "express";
import {
  filterGuestSensorPayload,
  requirePermission,
} from "../middleware/auth";
import {
  GetSensorDataResponse,
  SendCommandBody,
  SendCommandResponse,
  GetThresholdsResponse,
  SetThresholdsBody,
  SetThresholdsResponse,
  GetConnectionStatusResponse,
  ConnectDeviceBody,
  ConnectDeviceResponse,
  ListSerialPortsResponse,
} from "@workspace/api-zod";
import {
  getSensorData,
  sendCommand,
  getThresholds,
  setThresholds,
  getConnectionStatus,
  connectSerial,
  startDemoMode,
  disconnect,
  getAvailablePorts,
  ingestSensorReading,
  getSensorDataForSource,
} from "../lib/yolobit";
import { getRecentSensorReadings } from "../lib/db";

const router: IRouter = Router();

// GET /api/data - returns latest sensor readings (public / guest / authenticated)
router.get(
  "/data",
  requirePermission("view:data"),
  filterGuestSensorPayload,
  async (req, res): Promise<void> => {
  // source=device1
  const source = typeof req.query["source"] === "string" ? req.query["source"] : typeof req.query["device"] === "string" ? req.query["device"] : null;
  
  const data = source ? getSensorDataForSource(source) ?? getSensorData() : getSensorData();
  const response = {
    temperature: data.temperature,
    humidity: data.humidity,
    luminosity: data.luminosity,
    timestamp: typeof data.timestamp === "string" ? data.timestamp : null,
    warnings: data.warnings,
  };
  res.json(GetSensorDataResponse.parse(response));
  },
);

// POST /api/data - accept sensor readings from WiFi devices or other external sources
router.post("/data", requirePermission("ingest:data"), async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown> | null;

  const temperature = body?.["temperature"];
  const humidity = body?.["humidity"];
  const luminosity = body?.["luminosity"];
  const timestamp = typeof body?.["timestamp"] === "string" ? body["timestamp"] : null;
  const sourceCandidate = typeof body?.["source"] === "string" ? body["source"] : typeof body?.["deviceId"] === "string" ? body["deviceId"] : "wifi";

  const isNullableNumber = (value: unknown): value is number | null => value === null || typeof value === "number";

  if (!isNullableNumber(temperature) || !isNullableNumber(humidity) || !isNullableNumber(luminosity)) {
    res.status(400).json({ error: "temperature, humidity, and luminosity must be numbers or null" });
    return;
  }

  try {
    await ingestSensorReading({
      source: sourceCandidate,
      temperature,
      humidity,
      luminosity,
      timestamp,
      rawPayload: body,
    });

    const current = getSensorDataForSource(sourceCandidate) ?? getSensorData();
    const response = {
      temperature: current.temperature,
      humidity: current.humidity,
      luminosity: current.luminosity,
      timestamp: typeof current.timestamp === "string" ? current.timestamp : null,
      warnings: current.warnings,
    };
    res.status(201).json(GetSensorDataResponse.parse(response));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    req.log.error({ err: msg }, "Could not ingest sensor reading");
    res.status(500).json({ error: "Could not ingest sensor reading" });
  }
});

// GET /api/data/history?limit=100 - returns recent readings from PostgreSQL
router.get("/data/history", requirePermission("view:history"), async (req, res): Promise<void> => {
  const parsedLimit = Number(req.query["limit"] ?? 100);
  const limit = Number.isNaN(parsedLimit) ? 100 : parsedLimit;

  try {
    const rows = await getRecentSensorReadings(limit);
    res.json({ items: rows });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    req.log.error({ err: msg }, "Could not fetch sensor history");
    res.status(500).json({ error: "Could not fetch sensor history" });
  }
});

// POST /api/control - send command to Yolobit (1-10)
router.post("/control", requirePermission("control:device"), async (req, res): Promise<void> => {
  const parsed = SendCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { command } = parsed.data;

  try {
    await sendCommand(command);
    res.json(SendCommandResponse.parse({ success: true, message: `Command "${command}" sent` }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    req.log.warn({ cmd: command, err: msg }, "Command send failed");
    res.status(400).json({ error: msg });
  }
});

// GET /api/thresholds - get current alert thresholds
router.get("/thresholds", requirePermission("view:thresholds"), async (_req, res): Promise<void> => {
  res.json(GetThresholdsResponse.parse(getThresholds()));
});

// POST /api/thresholds - update alert thresholds
router.post("/thresholds", requirePermission("edit:thresholds"), async (req, res): Promise<void> => {
  const parsed = SetThresholdsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = setThresholds(parsed.data.tempMax, parsed.data.humidMin);
  res.json(SetThresholdsResponse.parse(result));
});

// GET /api/connection - get connection status
router.get("/connection", requirePermission("view:connection"), async (_req, res): Promise<void> => {
  res.json(GetConnectionStatusResponse.parse(getConnectionStatus()));
});

// POST /api/connection - connect to device
router.post("/connection", requirePermission("manage:connection"), async (req, res): Promise<void> => {
  const parsed = ConnectDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { port } = parsed.data;

  try {
    if (port === "demo") {
      startDemoMode();
    } else {
      await connectSerial(port);
    }
    res.json(ConnectDeviceResponse.parse(getConnectionStatus()));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    req.log.error({ port, err: msg }, "Connection failed");
    res.status(400).json({ error: msg });
  }
});

// DELETE /api/connection - disconnect device
router.delete("/connection", requirePermission("manage:connection"), async (_req, res): Promise<void> => {
  await disconnect();
  res.json(GetConnectionStatusResponse.parse(getConnectionStatus()));
});

// GET /api/ports - list available serial ports
router.get("/ports", requirePermission("view:ports"), async (_req, res): Promise<void> => {
  const ports = await getAvailablePorts();
  res.json(ListSerialPortsResponse.parse({ ports }));
});

export default router;
