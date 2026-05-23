import type { NextFunction, Request, Response } from "express";
import type { EffectiveRole, Permission } from "@workspace/rbac";
import { roleHasPermission } from "@workspace/rbac";
import type { AuthContext } from "../types/express";
import { verifyAccessToken } from "../lib/auth/jwt";

function parseBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token === "" ? null : token;
}

function buildAuthContext(payload: {
  sub: number;
  username: string;
  role: AuthContext["role"];
}): AuthContext {
  return {
    userId: payload.sub,
    username: payload.username,
    role: payload.role,
    effectiveRole: payload.role,
  };
}

export function getEffectiveRole(req: Request): EffectiveRole {
  return req.auth?.effectiveRole ?? "guest";
}

/** Attach authenticated user when a valid Bearer token is present. */
export function authenticateOptional(req: Request, _res: Response, next: NextFunction): void {
  const token = parseBearerToken(req);

  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = buildAuthContext(payload);
    next();
  } catch {
    _res.status(401).json({ error: "Invalid or expired access token" });
  }
}

/** Require a valid Bearer token. */
export function authenticateRequired(req: Request, res: Response, next: NextFunction): void {
  const token = parseBearerToken(req);

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = buildAuthContext(payload);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
}

/** Enforce RBAC permission for the current effective role. */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = getEffectiveRole(req);

    if (!roleHasPermission(role, permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}

/** Strip luminosity and threshold warnings for guest responses on GET /data. */
export function filterGuestSensorPayload(req: Request, res: Response, next: NextFunction): void {
  if (getEffectiveRole(req) !== "guest") {
    next();
    return;
  }

  const originalJson = res.json.bind(res);

  res.json = (body: unknown) => {
    if (!body || typeof body !== "object") {
      return originalJson(body);
    }

    const record = body as Record<string, unknown>;

    return originalJson({
      temperature: record["temperature"] ?? null,
      humidity: record["humidity"] ?? null,
      luminosity: null,
      timestamp: record["timestamp"] ?? null,
      warnings: {
        temperatureHigh: false,
        humidityLow: false,
      },
    });
  };

  next();
}
