import { customFetch } from "@workspace/api-client-react";
import type { EffectiveRole, StoredRole } from "@workspace/rbac";

export interface AuthUser {
  id: number;
  username: string;
  role: StoredRole;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

export function getEffectiveRoleFromUser(user: AuthUser | null): EffectiveRole {
  return user?.role ?? "guest";
}

export async function loginRequest(username: string, password: string): Promise<LoginResponse> {
  return customFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function registerRequest(username: string, password: string): Promise<LoginResponse> {
  return customFetch<LoginResponse>("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

export async function meRequest(token: string): Promise<MeResponse> {
  return customFetch<MeResponse>("/api/auth/me", {
    headers: { authorization: `Bearer ${token}` },
  });
}
