# RBAC Implementation Guide (Priority Readme)

This document describes the Role-Based Access Control system added to the Yolobit Smart Home IoT Dashboard. **Existing MQTT, USB serial, and realtime polling paths are unchanged** — RBAC is layered only on HTTP routes and UI visibility.

---

## 1. Architecture Overview

```
Yolobit → USB/MQTT → yolobit.ts (unchanged) → Express /api/* → React Dashboard
                              ↑
                    RBAC middleware (new, HTTP only)
```

| Layer | Responsibility |
|--------|----------------|
| `@workspace/rbac` | Shared roles, permissions, helpers |
| `@workspace/db` | `users` table (Drizzle) |
| `api-server` middleware | JWT parsing, permission guards |
| `api-server/routes/auth.ts` | Login, register, me |
| `iot-dashboard` | AuthContext, RoleGuard, role-based UI |

**Guest** is not stored in PostgreSQL. Unauthenticated requests receive effective role `guest`.

---

## 2. JWT Authentication Flow

```mermaid
sequenceDiagram
  participant UI as React Dashboard
  participant API as Express API
  participant DB as PostgreSQL

  UI->>API: POST /api/auth/login {username, password}
  API->>DB: Lookup user + bcrypt verify
  API-->>UI: { accessToken, user }
  UI->>UI: localStorage token

  loop Poll / protected calls
    UI->>API: Authorization: Bearer &lt;token&gt;
    API->>API: verify JWT (exp + signature)
    API->>API: attach req.auth
    API-->>UI: JSON response
  end

  UI->>API: GET /api/auth/me
  API-->>UI: { user }
```

**Environment variables (required in production):**

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Signing secret (no hardcoded values) |
| `JWT_EXPIRES_IN` | Token TTL (default `24h`) |
| `DATABASE_URL` | PostgreSQL connection |

Copy `.env.example` to `.env` before local or Docker runs.

---

## 3. Route Protection Flow

1. `routes/index.ts` mounts `authenticateOptional` on all routes below `/healthz`.
2. Valid Bearer token → `req.auth` with `userId`, `username`, `role`.
3. Missing token → effective role `guest`.
4. Invalid/expired token → **401** (fail closed).
5. Per-route `requirePermission(...)` → **403** if role lacks permission.

IoT handlers in `routes/iot.ts` are **not rewritten** — only middleware arrays were prepended.

---

## 4. File Structure

### Created

| Path | Purpose |
|------|---------|
| `lib/rbac/src/index.ts` | Shared roles & permission matrix |
| `lib/db/src/schema/users.ts` | `users` Drizzle table |
| `artifacts/api-server/src/lib/auth/*` | JWT, bcrypt, users, seed, Zod schemas |
| `artifacts/api-server/src/middleware/auth.ts` | Auth + RBAC + guest sensor filter |
| `artifacts/api-server/src/routes/auth.ts` | `/api/auth/login`, `register`, `me`, `users` |
| `artifacts/api-server/src/types/express.d.ts` | `req.auth` typing |
| `artifacts/iot-dashboard/src/contexts/AuthContext.tsx` | Session state + token getter |
| `artifacts/iot-dashboard/src/lib/auth-api.ts` | Auth HTTP client |
| `artifacts/iot-dashboard/src/lib/auth-storage.ts` | Token persistence |
| `artifacts/iot-dashboard/src/components/auth/RoleGuard.tsx` | UI permission wrapper |
| `artifacts/iot-dashboard/src/components/auth/ProtectedRoute.tsx` | Login-only pages |
| `artifacts/iot-dashboard/src/pages/Login.tsx` | Sign-in screen |
| `.env.example` | Documented secrets |

### Modified (safe extensions)

| Path | Change |
|------|--------|
| `artifacts/api-server/src/routes/iot.ts` | Middleware only |
| `artifacts/api-server/src/routes/index.ts` | Auth router + optional auth |
| `artifacts/api-server/src/index.ts` | Seed default users |
| `artifacts/iot-dashboard/src/pages/Dashboard.tsx` | Role-based layout |
| `artifacts/iot-dashboard/src/App.tsx` | AuthProvider + `/login` |
| `docker-compose.yml` | `JWT_SECRET`, `JWT_EXPIRES_IN` |

### Untouched (by design)

- `artifacts/api-server/src/lib/yolobit.ts`
- `artifacts/api-server/src/lib/mqtt.ts`
- `artifacts/api-server/src/index.ts` MQTT init
- Realtime `refetchInterval` on `useGetSensorData`

---

## 5. Middleware Explanation

| Middleware | Behavior |
|------------|----------|
| `authenticateOptional` | Parse Bearer JWT; set `req.auth` or leave guest |
| `authenticateRequired` | 401 if no valid token |
| `requirePermission(p)` | 403 if `roleHasPermission(effectiveRole, p)` is false |
| `filterGuestSensorPayload` | Strips luminosity & warnings for guest on `GET /data` |

---

## 6. Permission Matrix

| Permission | guest | user | developer | admin |
|------------|:-----:|:----:|:---------:|:-----:|
| view:data (GET /data) | ✓ | ✓ | ✓ | ✓ |
| view:connection | | ✓ | | ✓ |
| view:thresholds | | | ✓ | ✓ |
| edit:thresholds | | | ✓ | ✓ |
| view:history | | | ✓ | ✓ |
| control:device | | | | ✓ |
| manage:connection | | | | ✓ |
| view:ports | | | | ✓ |
| ingest:data (POST /data) | | | | ✓ |
| manage:users | | | | ✓ |

### HTTP route map

| Route | Minimum permission |
|-------|-------------------|
| `GET /api/data` | view:data |
| `POST /api/data` | ingest:data |
| `GET /api/data/history` | view:history |
| `POST /api/control` | control:device |
| `GET /api/thresholds` | view:thresholds |
| `POST /api/thresholds` | edit:thresholds |
| `GET /api/connection` | view:connection |
| `POST/DELETE /api/connection` | manage:connection |
| `GET /api/ports` | view:ports |
| `POST /api/auth/login` | public |
| `POST /api/auth/register` | public (role assignment restricted) |
| `GET /api/auth/me` | authenticated |
| `GET /api/auth/users` | manage:users |

---

## 7. Frontend Guard Logic

| Role | Dashboard UI |
|------|----------------|
| **guest** | Temperature + humidity cards only; sign-in link |
| **user** | All sensor cards, read-only connection status |
| **developer** | Sensors + threshold settings (no control/connection mgmt) |
| **admin** | Full dashboard (control panel + connection management) |

Components:

- `AuthProvider` — bootstraps token, registers `setAuthTokenGetter` for Orval client
- `useAuth()` — `role`, `can()`, `hasMinRole()`, `login`, `logout`
- `RoleGuard` — hides children when permission/role insufficient
- `ProtectedRoute` — redirects anonymous users (for future admin-only pages)

Unauthorized controls are **not rendered** (not merely disabled).

---

## 8. Security Best Practices

- Passwords hashed with **bcrypt** (12 rounds)
- JWT validated for signature and expiration
- Secrets only via environment variables
- Zod validation on auth bodies (length limits, trimmed username)
- Generic login error message (no user enumeration)
- First registered user becomes `admin` when DB is empty; elevated roles require admin token
- Default seed accounts for local/demo only — rotate in production

---

## 9. Database Migration Steps

```bash
# From repo root
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET

pnpm install
pnpm push   # drizzle-kit push — creates users table + user_role enum
```

Start API (seeds demo users when `users` is empty):

```bash
pnpm --filter @workspace/api-server run dev
```

Docker:

```bash
# .env must define JWT_SECRET
docker compose up --build
```

---

## 10. Testing Guide

### API (curl)

```bash
# Guest — public telemetry
curl http://localhost:8080/api/data

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Use token
TOKEN=<accessToken from response>
curl http://localhost:8080/api/connection -H "Authorization: Bearer $TOKEN"

# Developer cannot control device (403)
curl -X POST http://localhost:8080/api/control \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"1"}'

# Guest cannot access thresholds (403)
curl http://localhost:8080/api/thresholds
```

### UI

1. Open `/` without login → guest view (2 sensors).
2. Sign in as `user/user123` → luminosity + connection status, no controls.
3. Sign in as `developer/dev123` → thresholds visible, no control panel.
4. Sign in as `admin/admin123` → full dashboard.
5. Confirm sensor polling still updates every 1s on all roles.

---

## 11. Example Accounts

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |
| developer | dev123 | developer |
| user | user123 | user |

Seeded automatically when the `users` table is empty on API startup.

---

## 12. MQTT / USB Safety Statement

RBAC middleware runs **only** on Express HTTP routers. `yolobit.ts`, serial port handlers, MQTT client callbacks, and in-memory sensor state updates are unchanged. Device traffic continues to flow: **Yolobit → USB/MQTT → yolobit → GET /api/data → React poll**.
