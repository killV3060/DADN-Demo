import type { EffectiveRole, StoredRole } from "@workspace/rbac";

export interface AuthContext {
  userId: number;
  username: string;
  role: StoredRole;
  effectiveRole: EffectiveRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
