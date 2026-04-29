# Yolobit IoT Dashboard

Full-stack IoT dashboard for the Yolobit microcontroller.
Monorepo managed with **pnpm workspaces**.

## Architecture (v2 — MQTT over WiFi)

```
Yolobit Board (WiFi)
  └─publish──▶ MQTT Broker (34.1.136.26:1883)
               topic: yolobit/sensor/1
  ◀─subscribe─ topic: yolobit/command/1

API Server (Node.js / Express 5)
  ├─ subscribes MQTT sensor topic → in-memory state
  ├─ publishes MQTT command topic on POST /api/control
  └─ exposes HTTP /api/* with JWT RBAC

Dashboard (React + Vite)
  └─ polls GET /api/data every 1 s
```

## Workspaces

| Package | Path | Description |
|---|---|---|
| `@workspace/api-server` | `artifacts/api-server` | Express 5 backend |
| `@workspace/iot-dashboard` | `artifacts/iot-dashboard` | React + Vite frontend |
| `@workspace/api-zod` | `lib/api-zod` | Zod request/response schemas |
| `@workspace/api-client-react` | `lib/api-client-react` | React Query hooks (generated) |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI 3.1 spec |

## RBAC Roles

| Role | Capabilities |
|---|---|
| **Guest** (no token) | `GET /api/data` — temperature + humidity only |
| **Admin** | Full sensor data, device controls, thresholds (read), connection |
| **Developer** | Admin + update thresholds (`POST /api/thresholds`) |

### Seed credentials

| User | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `developer` | `dev123` | developer |

Re-seed: `pnpm --filter @workspace/scripts run seed-users`

## MQTT Topics & Commands (v2)

| Topic | Direction | Description |
|---|---|---|
| `yolobit/sensor/1` | Device → API | JSON sensor readings every 10 s |
| `yolobit/command/1` | API → Device | JSON command payload |

### Commands

| Command | Action |
|---|---|
| `"1"` | Servo 0° (open) |
| `"2"` | Servo 180° (close) |
| `"3"` | LED on |
| `"4"` | LED off |
| `"FAN:0"` | Fan off |
| `"FAN:33"` | Fan 33% |
| `"FAN:66"` | Fan 66% |
| `"FAN:100"` | Fan 100% |

## Connection Modes

`POST /api/connection { "mode": "demo" | "mqtt" }`

- **demo** — simulated sensor data generated locally (no hardware needed)
- **mqtt** — real device data via MQTT broker subscription

## Environment Variables (api-server)

| Variable | Default | Description |
|---|---|---|
| `API_PORT` | `8080` | Server port |
| `MQTT_URL` | — | MQTT broker URL e.g. `mqtt://34.1.136.26:1883` (optional — disabled when unset) |
| `MQTT_SENSOR_TOPIC` | `yolobit/sensor/+` | Topic to subscribe for sensor data |
| `MQTT_COMMAND_TOPIC` | `yolobit/command` | Base topic for commands |
| `DEVICE_ID` | `1` | Device ID used in MQTT topics |
| `DATABASE_URL` | (auto) | PostgreSQL connection string (provisioned by Replit) |
| `JWT_SECRET` | `dev-secret-change-in-production` | Secret for JWT signing — set in production |

## Local Setup Steps

1. `pnpm install`
2. Database is auto-provisioned (Replit). Push schema: `pnpm --filter @workspace/db run push`
3. Seed users: `pnpm --filter @workspace/scripts run seed-users`
4. Start workflows (api-server on 8080, web on 23411).

## Device (MicroPython)

See `device/device.py` — upload to Yolobit via Thonny IDE.
Requires `umqtt.simple` library. Publishes sensor JSON every 10 s;
subscribes to command topic and drives servo, LED, and fan via PWM.

## Key Files

- `artifacts/api-server/src/lib/mqtt.ts` — MQTT client init, pub/sub
- `artifacts/api-server/src/lib/yolobit.ts` — Sensor state, command dispatch
- `artifacts/api-server/src/routes/iot.ts` — HTTP routes with RBAC
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware
- `artifacts/api-server/src/middlewares/rbac.ts` — Role middleware
- `artifacts/iot-dashboard/src/components/dashboard/ConnectionPanel.tsx` — Mode toggle UI
- `artifacts/iot-dashboard/src/components/dashboard/ControlPanel.tsx` — Device controls UI
- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 spec
- `device/device.py` — MicroPython firmware for Yolobit
