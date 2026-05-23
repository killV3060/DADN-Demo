import type { ReactNode } from "react";
import type { EffectiveRole, Permission } from "@workspace/rbac";
import { useAuth } from "@/contexts/AuthContext";

interface RoleGuardProps {
  children: ReactNode;
  /** Minimum role required (inclusive). */
  minRole?: EffectiveRole;
  /** Specific permission required. */
  permission?: Permission;
  fallback?: ReactNode;
}

export function RoleGuard({ children, minRole, permission, fallback = null }: RoleGuardProps) {
  const { hasMinRole: hasRole, can } = useAuth();

  const allowed =
    (minRole ? hasRole(minRole) : true) &&
    (permission ? can(permission) : true);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
