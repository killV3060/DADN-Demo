import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import type { EffectiveRole } from "@workspace/rbac";
import { hasMinRole, roleHasPermission, type Permission } from "@workspace/rbac";
import {
  getEffectiveRoleFromUser,
  loginRequest,
  meRequest,
  type AuthUser,
} from "@/lib/auth-api";
import { getStoredToken, setStoredToken } from "@/lib/auth-storage";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  role: EffectiveRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  can: (permission: Permission) => boolean;
  hasMinRole: (minimum: EffectiveRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  const role = getEffectiveRoleFromUser(user);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setStoredToken(null);
  }, []);

  const refreshMe = useCallback(async () => {
    const activeToken = getStoredToken();

    if (!activeToken) {
      setUser(null);
      setToken(null);
      return;
    }

    const response = await meRequest(activeToken);
    setUser(response.user);
    setToken(activeToken);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await loginRequest(username, password);
    setStoredToken(response.accessToken);
    setToken(response.accessToken);
    setUser(response.user);
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => getStoredToken());
    return () => setAuthTokenGetter(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = getStoredToken();

      if (!stored) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await meRequest(stored);
        if (!cancelled) {
          setToken(stored);
          setUser(response.user);
        }
      } catch {
        if (!cancelled) {
          setStoredToken(null);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      role,
      isLoading,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
      refreshMe,
      can: (permission) => roleHasPermission(role, permission),
      hasMinRole: (minimum) => hasMinRole(role, minimum),
    }),
    [user, token, role, isLoading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
