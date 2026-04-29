// iot.ts - Controller: IoT API with RBAC
//
// Role access:
//   Guest (no token)  : GET /data (temp + humidity only, luminosity hidden)
//   Admin             : GET /data (full) + POST /control + GET /thresholds + connection/ports
//   Developer         : all Admin permissions + POST /thresholds
//
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
import { optionalAuth, requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";

const router: IRouter = Router();

// ── GET /api/data ──────────────────────────────────────────────────────────────
// Public endpoint — guests see only temperature + humidity.
// Admin / Developer see the full response including luminosity.
router.get("/data", optionalAuth, async (req, res): Promise<void> => {
  const data = getSensorData();

  // Guest: hide luminosity and device-specific warnings about luminosity
  if (!req.user) {
    res.json(
      GetSensorDataResponse.parse({
        ...data,
        luminosity: null, // restricted for guests
      }),
    );
    return;
  }

  res.json(GetSensorDataResponse.parse(data));
});

// ── POST /api/control ─────────────────────────────────────────── Admin+ ──────
router.post("/control", requireAuth, requireRole("admin", "developer"), async (req, res): Promise<void> => {
  const parsed = SendCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    await sendCommand(parsed.data.command);
    res.json(SendCommandResponse.parse({ success: true, message: `Command "${parsed.data.command}" sent` }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    req.log.warn({ cmd: parsed.data.command, err: msg }, "Command failed");
    res.status(400).json({ error: msg });
  }
});

// ── GET /api/thresholds ───────────────────────────────────────── Admin+ ──────
router.get("/thresholds", requireAuth, requireRole("admin", "developer"), async (_req, res): Promise<void> => {
  res.json(GetThresholdsResponse.parse(getThresholds()));
});

// ── POST /api/thresholds ─────────────────────────────────── Developer only ───
router.post("/thresholds", requireAuth, requireRole("developer"), async (req, res): Promise<void> => {
  const parsed = SetThresholdsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(SetThresholdsResponse.parse(setThresholds(parsed.data.tempMax, parsed.data.humidMin)));
});

// ── GET /api/connection ──────────────────────────────────────── Admin+ ───────
router.get("/connection", requireAuth, requireRole("admin", "developer"), async (_req, res): Promise<void> => {
  res.json(GetConnectionStatusResponse.parse(getConnectionStatus()));
});

// ── POST /api/connection ─────────────────────────────────────── Admin+ ───────
router.post("/connection", requireAuth, requireRole("admin", "developer"), async (req, res): Promise<void> => {
  const parsed = ConnectDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    if (parsed.data.port === "demo") {
      await startDemoMode();
    } else {
      await connectSerial(parsed.data.port);
    }
    res.json(ConnectDeviceResponse.parse(getConnectionStatus()));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    req.log.error({ port: parsed.data.port, err: msg }, "Connection failed");
    res.status(400).json({ error: msg });
  }
});

// ── DELETE /api/connection ───────────────────────────────────── Admin+ ───────
router.delete("/connection", requireAuth, requireRole("admin", "developer"), async (_req, res): Promise<void> => {
  await disconnect();
  res.json(GetConnectionStatusResponse.parse(getConnectionStatus()));
});

// ── GET /api/ports ───────────────────────────────────────────── Admin+ ───────
router.get("/ports", requireAuth, requireRole("admin", "developer"), async (_req, res): Promise<void> => {
  const ports = await getAvailablePorts();
  res.json(ListSerialPortsResponse.parse({ ports }));
});

export default router;
