// iot.ts - Controller: Express routes for IoT API
import { Router, type IRouter } from "express";
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
} from "../lib/yolobit";

const router: IRouter = Router();

// GET /api/data - returns latest sensor readings
router.get("/data", async (req, res): Promise<void> => {
  const data = getSensorData();
  res.json(GetSensorDataResponse.parse(data));
});

// POST /api/control - send command to Yolobit (1-10)
router.post("/control", async (req, res): Promise<void> => {
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
router.get("/thresholds", async (_req, res): Promise<void> => {
  res.json(GetThresholdsResponse.parse(getThresholds()));
});

// POST /api/thresholds - update alert thresholds
router.post("/thresholds", async (req, res): Promise<void> => {
  const parsed = SetThresholdsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = setThresholds(parsed.data.tempMax, parsed.data.humidMin);
  res.json(SetThresholdsResponse.parse(result));
});

// GET /api/connection - get connection status
router.get("/connection", async (_req, res): Promise<void> => {
  res.json(GetConnectionStatusResponse.parse(getConnectionStatus()));
});

// POST /api/connection - connect to device
router.post("/connection", async (req, res): Promise<void> => {
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
router.delete("/connection", async (_req, res): Promise<void> => {
  await disconnect();
  res.json(GetConnectionStatusResponse.parse(getConnectionStatus()));
});

// GET /api/ports - list available serial ports
router.get("/ports", async (_req, res): Promise<void> => {
  const ports = await getAvailablePorts();
  res.json(ListSerialPortsResponse.parse({ ports }));
});

export default router;
