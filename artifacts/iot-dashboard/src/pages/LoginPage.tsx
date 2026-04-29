// LoginPage — shown when a user wants to log in as admin or developer
// Guests can dismiss this and continue with read-only access.
import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Cpu, LogIn, Eye, EyeOff } from "lucide-react";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/context/AuthContext";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loginMutation = useLogin({
    mutation: {
      onSuccess(data) {
        const user: AuthUser = {
          id: data.user.id,
          username: data.user.username,
          role: data.user.role as AuthUser["role"],
        };
        login(data.token, user);
        navigate("/");
      },
      onError(err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setFormError(msg ?? "Login failed. Check your credentials.");
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    loginMutation.mutate({ data: { username, password } });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/20 border border-primary/30 text-primary shadow-[0_0_30px_-5px_rgba(var(--primary),0.5)]">
            <Cpu className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-display font-bold text-gradient-primary">Yolobit Nexus</h1>
          <p className="text-muted-foreground text-sm">Sign in to access admin controls</p>
        </div>

        {/* Card */}
        <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-foreground/80">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-background/50 border border-border/60 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                placeholder="admin or developer"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground/80">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-background/50 border border-border/60 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {formError && (
              <p className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                {formError}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-wait text-primary-foreground font-semibold py-2.5 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)] hover:shadow-[0_0_30px_-5px_rgba(var(--primary),0.7)]"
            >
              <LogIn className="w-4 h-4" />
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Guest shortcut */}
        <p className="text-center text-sm text-muted-foreground">
          Just browsing?{" "}
          <button
            onClick={() => navigate("/")}
            className="text-primary hover:text-primary/80 font-medium underline-offset-2 hover:underline transition-colors"
          >
            Continue as guest
          </button>
        </p>

        {/* Role hint */}
        <div className="text-center text-xs text-muted-foreground/60 space-y-1">
          <p>Guest: temperature &amp; humidity only</p>
          <p>Admin: full sensors + device control</p>
          <p>Developer: admin + threshold config</p>
        </div>

      </div>
    </div>
  );
}
