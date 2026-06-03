import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, LogIn, User } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    navigate("/");
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
      toast({ title: "Signed in", description: "Welcome back to Yolobit Nexus." });
      navigate("/");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast({ variant: "destructive", title: "Login failed", description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <GlassCard className="w-full max-w-md p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-display font-bold text-gradient-primary">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Use demo accounts: admin/admin123, developer/dev123, user/user123
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Username</span>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                className="w-full rounded-xl border border-border/50 bg-background/50 pl-10 pr-3 py-2.5 text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={3}
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Password</span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                className="w-full rounded-xl border border-border/50 bg-background/50 pl-10 pr-3 py-2.5 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                minLength={6}
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Continue without signing in to browse as guest (temperature & humidity only).
        </p>
        <button
          type="button"
          className="w-full text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/")}
        >
          Continue as guest
        </button>
      </GlassCard>
    </div>
  );
}
