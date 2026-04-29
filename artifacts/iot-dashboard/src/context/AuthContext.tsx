// AuthContext — stores JWT token + decoded user info globally
// Role hierarchy: guest (unauthenticated) < admin < developer
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export type UserRole = "guest" | "admin" | "developer";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;     // null = guest
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAdmin: boolean;          // admin OR developer
  isDeveloper: boolean;      // developer only
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Attempt to rehydrate from localStorage on first mount
function loadStoredAuth(): { token: string; user: AuthUser } | null {
  try {
    const token = localStorage.getItem("token");
    const raw = localStorage.getItem("user");
    if (token && raw) {
      return { token, user: JSON.parse(raw) as AuthUser };
    }
  } catch {
    /* corrupted storage — ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStoredAuth();

  const [token, setToken] = useState<string | null>(stored?.token ?? null);
  const [user, setUser] = useState<AuthUser | null>(stored?.user ?? null);

  // Wire the API client to read our token from state via a getter
  setAuthTokenGetter(() => localStorage.getItem("token"));

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin" || user?.role === "developer";
  const isDeveloper = user?.role === "developer";

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isDeveloper }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
