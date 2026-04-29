// iot.ts - Controller: IoT API with RBAC
//
// Role access:
//   Guest (no token)  : GET /data (temp + humidity only)
//   Admin             : full data + control + thresholds + connection
//   Developer         : all + update thresholds

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
} from "@workspace/api-zod";

import {
  getSensorData,
  sendCommand,
  getThresholds,
  setThresholds,
  getConnectionStatus,
  connectMqtt,
  startDemoMode,
  disconnect,
} from "../lib/yolobit";

import { getRecentSensorReadings } from "../lib/db";
import { optionalAuth, requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/rbac";

const router: IRouter = Router();


// ───────────────────────────────────────────────────────────────
// GET /api/data
// Guest: only temp + humidity
// Admin/Dev: full data
// ───────────────────────────────────────────────────────────────
router.get("/data", optionalAuth, async (req, res): Promise<void> => {
  const data = getSensorData();

  if (!req.user) {
    res.json(
      GetSensorDataResponse.parse({
        ...data,
        luminosity: null,
      }),
    );
    return;
  }

  res.json(GetSensorDataResponse.parse(data));
});


// ───────────────────────────────────────────────────────────────
// GET /api/data/history (DB log)
// ───────────────────────────────────────────────────────────────
router.get("/data/history", requireAuth, requireRole("admin", "developer"), async (req, res): Promise<void> => {
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


// ───────────────────────────────────────────────────────────────
// POST /api/control
// Publishes command to MQTT topic yolobit/command/{deviceId}
// Admin + Developer
// ───────────────────────────────────────────────────────────────
router.post(
  "/control",
  requireAuth,
  requireRole("admin", "developer"),
  async (req, res): Promise<void> => {
    const parsed = SendCommandBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    try {
      await sendCommand(parsed.data.command);
      res.json(
        SendCommandResponse.parse({
          success: true,
          message: `Command "${parsed.data.command}" sent`,
        }),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      req.log.warn({ cmd: parsed.data.command, err: msg }, "Command failed");
      res.status(400).json({ error: msg });
    }
  },
);


// ───────────────────────────────────────────────────────────────
// GET /api/thresholds (Admin+)
// ───────────────────────────────────────────────────────────────
router.get(
  "/thresholds",
  requireAuth,
  requireRole("admin", "developer"),
  async (_req, res): Promise<void> => {
    res.json(GetThresholdsResponse.parse(getThresholds()));
  },
);


// ───────────────────────────────────────────────────────────────
// POST /api/thresholds (Developer only)
// ───────────────────────────────────────────────────────────────
router.post(
  "/thresholds",
  requireAuth,
  requireRole("developer"),
  async (req, res): Promise<void> => {
    const parsed = SetThresholdsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    res.json(
      SetThresholdsResponse.parse(
        setThresholds(parsed.data.tempMax, parsed.data.humidMin),
      ),
    );
  },
);


// ───────────────────────────────────────────────────────────────
// GET /api/connection (Admin+)
// ───────────────────────────────────────────────────────────────
router.get(
  "/connection",
  requireAuth,
  requireRole("admin", "developer"),
  async (_req, res): Promise<void> => {
    res.json(GetConnectionStatusResponse.parse(getConnectionStatus()));
  },
);


// ───────────────────────────────────────────────────────────────
// POST /api/connection { mode: "demo" | "mqtt" }
// Admin+
// ───────────────────────────────────────────────────────────────
router.post(
  "/connection",
  requireAuth,
  requireRole("admin", "developer"),
  async (req, res): Promise<void> => {
    const parsed = ConnectDeviceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    try {
      if (parsed.data.mode === "demo") {
        await startDemoMode();
      } else {
        connectMqtt();
      }

      res.json(ConnectDeviceResponse.parse(getConnectionStatus()));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      req.log.error({ mode: parsed.data.mode, err: msg }, "Connection failed");
      res.status(400).json({ error: msg });
    }
  },
);


// ───────────────────────────────────────────────────────────────
// DELETE /api/connection (Admin+)
// ───────────────────────────────────────────────────────────────
router.delete(
  "/connection",
  requireAuth,
  requireRole("admin", "developer"),
  async (_req, res): Promise<void> => {
    await disconnect();
    res.json(GetConnectionStatusResponse.parse(getConnectionStatus()));
  },
);

export default router;
