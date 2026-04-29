// auth.ts - JWT verification middleware
// Adds req.user if a valid Bearer token is present
import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
export const JWT_EXPIRES_IN = "24h";

// Shape of the JWT payload stored in the token
export interface JwtPayload {
  id: number;
  username: string;
  role: "admin" | "developer";
}

// Extend Express Request so TypeScript knows about req.user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Helper: extract Bearer token from Authorization header
function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/**
 * optionalAuth — attaches req.user if a valid token is present.
 * Does NOT reject the request if no token is provided (guests pass through).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      // Invalid token — treat as guest, don't block
    }
  }
  next();
}

/**
 * requireAuth — requires a valid JWT token.
 * Returns 401 if missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
