// rbac.ts - Role-Based Access Control middleware
// Usage: router.post("/route", requireAuth, requireRole("admin", "developer"), handler)
import { type Request, type Response, type NextFunction } from "express";
import type { JwtPayload } from "./auth";

type Role = JwtPayload["role"];

/**
 * requireRole(...roles) — factory that returns a middleware checking
 * whether req.user.role is one of the allowed roles.
 *
 * Must be used AFTER requireAuth (which attaches req.user).
 *
 * Example:
 *   router.post("/thresholds", requireAuth, requireRole("developer"), handler)
 */
export function requireRole(...roles: Role[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden. Required role: ${roles.join(" or ")}. Your role: ${req.user?.role ?? "guest"}`,
      });
      return;
    }
    next();
  };
}
