import { z } from "zod";

/** Stored in PostgreSQL — guest is never persisted. */
export const STORED_ROLES = ["admin", "developer", "user"] as const;
export type StoredRole = (typeof STORED_ROLES)[number];

/** Effective role for authorization (includes unauthenticated guest). */
export const EFFECTIVE_ROLES = [...STORED_ROLES, "guest"] as const;
export type EffectiveRole = (typeof EFFECTIVE_ROLES)[number];

export const storedRoleSchema = z.enum(STORED_ROLES);
export const effectiveRoleSchema = z.enum(EFFECTIVE_ROLES);

export const PERMISSIONS = {
  "view:data": ["guest", "user", "developer", "admin"],
  "view:connection": ["user", "admin"],
  "view:thresholds": ["developer", "admin"],
  "edit:thresholds": ["developer", "admin"],
  "view:history": ["developer", "admin"],
  "control:device": ["admin"],
  "manage:connection": ["admin"],
  "view:ports": ["admin"],
  "ingest:data": ["admin"],
  "manage:users": ["admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function isStoredRole(value: string): value is StoredRole {
  return (STORED_ROLES as readonly string[]).includes(value);
}

export function isEffectiveRole(value: string): value is EffectiveRole {
  return (EFFECTIVE_ROLES as readonly string[]).includes(value);
}

export function roleHasPermission(role: EffectiveRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly EffectiveRole[]).includes(role);
}

export function minRole(role: EffectiveRole): number {
  const order: Record<EffectiveRole, number> = {
    guest: 0,
    user: 1,
    developer: 2,
    admin: 3,
  };
  return order[role];
}

export function hasMinRole(role: EffectiveRole, minimum: EffectiveRole): boolean {
  return minRole(role) >= minRole(minimum);
}
