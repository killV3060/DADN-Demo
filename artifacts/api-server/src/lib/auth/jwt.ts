import jwt, { type SignOptions } from "jsonwebtoken";
import type { StoredRole } from "@workspace/rbac";
import { getJwtExpiresIn, getJwtSecret } from "./config";

export interface AccessTokenPayload {
  sub: number;
  username: string;
  role: StoredRole;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: getJwtExpiresIn() as SignOptions["expiresIn"],
    subject: String(payload.sub),
  };

  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());

  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid token payload");
  }

  const record = decoded as Record<string, unknown>;
  const sub = Number(record["sub"]);
  const username = record["username"];
  const role = record["role"];

  if (!Number.isInteger(sub) || sub <= 0) {
    throw new Error("Invalid token subject");
  }

  if (typeof username !== "string" || username.trim() === "") {
    throw new Error("Invalid token username");
  }

  if (role !== "admin" && role !== "developer" && role !== "user") {
    throw new Error("Invalid token role");
  }

  return {
    sub,
    username,
    role,
  };
}
