# Yolobit Smart Home IoT Dashboard

A full-stack IoT dashboard for the **Yolobit** microcontroller. Sensor
telemetry (temperature, humidity, luminosity) flows from the device over
**MQTT/WiFi** to a Node.js API, which exposes a REST interface consumed by a
React dashboard with role-based access control.

```
┌─────────────────┐   MQTT publish    ┌──────────────┐
│  Yolobit Board  │ ────────────────▶ │              │
│  (MicroPython)  │                   │  MQTT Broker │
│   WiFi sensors  │ ◀──────────────── │              │
└─────────────────┘    MQTT command   └──────┬───────┘
                                             │
                                             │ subscribe / publish
                                             ▼
                                   ┌────────────────────┐
                                   │   API Server       │
                                   │   Express 5 + JWT  │
                                   │   PostgreSQL/Drizzle│
                                   └─────────┬──────────┘
                                             │ REST /api/*
                                             ▼
                                   ┌────────────────────┐
                                   │  React Dashboard   │
                                   │  Vite + Query      │
                                   └────────────────────┘
```

---

## Tech Stack

| Layer       | Technology                                                       |
| ----------- | ---------------------------------------------------------------- |
| Frontend    | React 18, Vite, TypeScript, TanStack Query, Tailwind, shadcn/ui  |
| Backend     | Node.js, Express 5, TypeScript, Pino logger, Zod validation      |
| Auth        | JWT (`jsonwebtoken`) + `bcryptjs` password hashing + RBAC        |
| Database    | PostgreSQL via Drizzle ORM (`drizzle-kit push` for migrations)   |
| Transport   | MQTT (`mqtt.js` client subscribing to broker)                    |
| Device      | MicroPython on Yolobit, `umqtt.simple`                           |
| Tooling     | pnpm workspaces, OpenAPI 3.1 → generated zod schemas + RQ hooks  |

---

## Repository Layout

```
.
├── artifacts/
│   ├── api-server/      Express 5 backend (auth, MQTT, REST)
│   ├── iot-dashboard/   React + Vite frontend
│   └── mqtt/            mosquitto.conf reference
├── lib/
│   ├── api-spec/        OpenAPI 3.1 spec (source of truth)
│   ├── api-zod/         Generated zod schemas + types
│   ├── api-client-react/Generated React Query hooks
│   └── db/              Drizzle ORM schema + client
├── scripts/             One-off scripts (seed-users, etc.)
├── device/              MicroPython firmware (device.py)
└── replit.md            Project memory for the AI agent
```

---

## RBAC Roles

| Role         | How to authenticate           | Capabilities                                                       |
| ------------ | ----------------------------- | ------------------------------------------------------------------ |
| **Guest**    | _no token_                    | `GET /api/data` — temperature & humidity only                      |
| **Admin**    | `admin` / `admin123`          | Full sensor data, device controls, read thresholds, change mode    |
| **Developer**| `developer` / `dev123`        | Everything Admin can do **plus** `POST /api/thresholds`            |

> ⚠️ Seed credentials are for **development only**. Change `JWT_SECRET` and
> rotate user passwords before deploying to production.

---

## REST API Highlights

| Method | Path                  | Auth         | Description                                  |
| ------ | --------------------- | ------------ | -------------------------------------------- |
| POST   | `/api/auth/login`     | none         | Returns `{ token, user }`                    |
| GET    | `/api/auth/me`        | any user     | Current authenticated user                   |
| GET    | `/api/healthz`        | none         | Liveness probe                               |
| GET    | `/api/data`           | role-aware   | Latest sensor reading (filtered by role)     |
| POST   | `/api/control`        | admin/dev    | Send a device command (servo / LED / fan)    |
| GET    | `/api/thresholds`     | admin/dev    | Read warning thresholds                      |
| POST   | `/api/thresholds`     | developer    | Update warning thresholds                    |
| POST   | `/api/connection`     | admin/dev    | Switch between `demo` and `mqtt` modes       |

The full OpenAPI 3.1 contract lives in `lib/api-spec/openapi.yaml`. Generated
zod schemas (`lib/api-zod`) and React Query hooks (`lib/api-client-react`) keep
client and server in sync.

---

## MQTT Contract

| Topic                | Direction      | Payload (JSON)                                                                |
| -------------------- | -------------- | ----------------------------------------------------------------------------- |
| `yolobit/sensor/+`   | Device → API   | `{ "temperature": 27.5, "humidity": 60, "luminosity": 480 }`                  |
| `yolobit/command/1`  | API → Device   | `{ "command": "FAN:66" }`                                                     |

### Supported commands

| Command   | Effect                  |
| --------- | ----------------------- |
| `"1"`     | Servo to 0° (open)      |
| `"2"`     | Servo to 180° (close)   |
| `"3"`     | LED on                  |
| `"4"`     | LED off                 |
| `"FAN:0"` | Fan off                 |
| `"FAN:33"`| Fan 33 %                |
| `"FAN:66"`| Fan 66 %                |
| `"FAN:100"`| Fan 100 %              |

Set `MQTT_URL` to enable real hardware. When `MQTT_URL` is unset the API still
runs (in `demo` mode) so the dashboard can be developed without a device.

---

## Environment Variables

### `@workspace/api-server`

| Variable             | Default                              | Required  | Notes                                              |
| -------------------- | ------------------------------------ | --------- | -------------------------------------------------- |
| `API_PORT`           | `8080`                               | no        | HTTP port                                          |
| `DATABASE_URL`       | _auto-provisioned on Replit_         | **yes**   | PostgreSQL connection string                       |
| `JWT_SECRET`         | `dev-secret-change-in-production`    | **yes** in prod | HMAC secret for JWT signing                  |
| `MQTT_URL`           | —                                    | no        | e.g. `mqtt://34.1.136.26:1883`. If empty → demo    |
| `MQTT_SENSOR_TOPIC`  | `yolobit/sensor/+`                   | no        | Wildcard subscription                              |
| `MQTT_COMMAND_TOPIC` | `yolobit/command`                    | no        | Base, device id is appended                        |
| `DEVICE_ID`          | `1`                                  | no        | Used to build `<base>/<id>` topics                 |

### `@workspace/iot-dashboard`

| Variable      | Default | Notes                                |
| ------------- | ------- | ------------------------------------ |
| `WEB_PORT`    | `23411` | Vite dev server port                 |
| `BASE_PATH`   | `/`     | Sub-path the dashboard is served at  |
| `API_PORT`    | `8080`  | Used for the dev proxy to the API    |

---

## How to Run (Replit)

Everything is pre-wired in the Replit workspace:

1. **Install dependencies** (already done on first boot):
   ```bash
   pnpm install
   ```
2. **Provision the database** — Replit auto-creates a Postgres instance and
   exports `DATABASE_URL`.
3. **Push the schema**:
   ```bash
   pnpm --filter @workspace/db run push
   ```
4. **Seed the demo users**:
   ```bash
   pnpm --filter @workspace/scripts run seed-users
   ```
5. **Start the workflows** (Replit does this for you):
   - `artifacts/api-server: API Server` → `http://localhost:8080`
   - `artifacts/iot-dashboard: web`     → `http://localhost:23411`

Open the **Web View** to see the dashboard, sign in with `admin` / `admin123`.

## How to Run (Local Machine)

```bash
# 1. install
pnpm install

# 2. set env vars (or create a .env at repo root)
export DATABASE_URL="postgres://user:pass@localhost:5432/yolobit"
export JWT_SECRET="something-strong"
export MQTT_URL="mqtt://localhost:1883"   # optional

# 3. database
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed-users

# 4. start (in two terminals)
pnpm --filter @workspace/api-server  run dev
pnpm --filter @workspace/iot-dashboard run dev
```

Backend listens on `http://localhost:8080`, frontend on `http://localhost:23411`.

---

## Production Build

```bash
pnpm --filter @workspace/iot-dashboard run build   # static dist/
pnpm --filter @workspace/api-server  run build    # tsc → dist/
pnpm --filter @workspace/api-server  run start    # node dist/index.js
```

The API server serves the dashboard's `dist/` as static assets in production,
so a single port (`API_PORT`) is enough to expose the whole app.

---

## Device Firmware

Upload `device/device.py` to the Yolobit using **Thonny IDE** (or `mpremote`).
The device requires:

- WiFi credentials (edit `WIFI_SSID` / `WIFI_PASS` in `device.py`)
- `MQTT_HOST` / `MQTT_PORT` matching the broker your API points at
- `umqtt.simple` library (bundled with most Yolobit firmware)

Behaviour:

- Reads DHT11 (temperature, humidity) and LDR (luminosity) every 10 s.
- Publishes JSON to `yolobit/sensor/<DEVICE_ID>`.
- Subscribes to `yolobit/command/<DEVICE_ID>` and drives the servo, LED, and
  PWM fan based on the received command string.

---

## Useful Scripts

| Command                                              | What it does                                |
| ---------------------------------------------------- | ------------------------------------------- |
| `pnpm --filter @workspace/db run push`               | Apply Drizzle schema to the database        |
| `pnpm --filter @workspace/scripts run seed-users`    | (Re)create the demo `admin` / `developer`   |
| `pnpm --filter @workspace/api-spec run codegen`      | Regenerate zod + RQ hooks from OpenAPI      |
| `pnpm --filter @workspace/api-server run build`      | Compile backend to `dist/`                  |
| `pnpm --filter @workspace/iot-dashboard run build`   | Build the frontend bundle                   |

---

## Troubleshooting

- **`WEB_PORT environment variable is required`** — restart the
  `iot-dashboard` workflow; the value is provided by `[services.env]` in the
  artifact configuration.
- **`MQTT_URL is not set. MQTT pub/sub is disabled.`** — expected when no
  broker is configured; the API falls back to demo data.
- **`DATABASE_URL, ensure the database is provisioned`** — on Replit, run
  `create_database` from the Tools panel; locally, set `DATABASE_URL` yourself.
- **401 from `/api/control`** — log in first via `POST /api/auth/login` and
  include `Authorization: Bearer <token>` on subsequent requests.

---

## License

Internal project. All rights reserved.
