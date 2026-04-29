import { useGetSensorData } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Activity, Droplets, Sun, AlertTriangle, Cpu, LogIn, LogOut, ShieldCheck, Code2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

import { SensorCard } from "@/components/dashboard/SensorCard";
import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { ConnectionPanel } from "@/components/dashboard/ConnectionPanel";
import { ThresholdSettings } from "@/components/dashboard/ThresholdSettings";
import { useAuth } from "@/context/AuthContext";

// Role badge config
const roleMeta = {
  guest:     { label: "Guest",      icon: null,        color: "text-muted-foreground   bg-muted/40          border-border/40" },
  admin:     { label: "Admin",      icon: ShieldCheck, color: "text-primary            bg-primary/10        border-primary/30" },
  developer: { label: "Developer",  icon: Code2,       color: "text-emerald-400        bg-emerald-500/10    border-emerald-500/30" },
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, logout, isAdmin, isDeveloper } = useAuth();

  const role = user?.role ?? "guest";
  const meta = roleMeta[role];
  const RoleIcon = meta.icon;

  const { data: sensorData, isError, error } = useGetSensorData({
    query: { 
      queryKey: ['sensor-data'],
      refetchInterval: 1000,
      retry: 2,
    },
  });

  const hasWarnings = sensorData?.warnings?.temperatureHigh || sensorData?.warnings?.humidityLow;

  const formattedTime = sensorData?.timestamp 
    ? format(new Date(sensorData.timestamp), "HH:mm:ss.SSS")
    : "--:--:--";

  return (
    <div className="min-h-screen pb-12 pt-6 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-8">
      
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]">
              <Cpu className="w-6 h-6" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-gradient-primary">
              Yolobit Nexus
            </h1>
          </div>
          <p className="text-muted-foreground ml-14">IoT Telemetry &amp; Control Center</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Role Badge */}
          <div className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-full text-xs font-semibold ${meta.color}`}>
            {RoleIcon && <RoleIcon className="w-3.5 h-3.5" />}
            {meta.label}
          </div>

          {/* Last sync */}
          <div className="flex items-center gap-3 bg-card/40 backdrop-blur-sm border border-border/50 px-4 py-2 rounded-full">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Last Sync</span>
              <span className="font-mono font-medium text-foreground">{formattedTime}</span>
            </div>
            <div className={`w-3 h-3 rounded-full ${sensorData ? 'bg-success animate-pulse' : 'bg-muted'} shadow-[0_0_10px_rgba(var(--success),0.5)]`} />
          </div>

          {/* Login / Logout */}
          {user ? (
            <button
              onClick={logout}
              title={`Logged in as ${user.username}`}
              className="flex items-center gap-1.5 border border-border/50 bg-card/40 hover:bg-card/70 text-muted-foreground hover:text-foreground px-3 py-2 rounded-full text-xs font-medium transition-all backdrop-blur-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-1.5 border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 rounded-full text-xs font-semibold transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* CONNECTION PANEL — Admin / Developer only */}
      {isAdmin && <ConnectionPanel />}

      {/* GUEST NOTICE */}
      {!isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/30 border border-border/40 rounded-2xl p-4 flex items-start gap-4"
        >
          <div className="p-2 bg-muted/40 rounded-full text-muted-foreground shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground/80">Read-only view</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You are viewing as a guest. Temperature and humidity are available.{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-primary hover:underline underline-offset-2 font-medium"
              >
                Sign in
              </button>{" "}
              to access device controls, luminosity, and settings.
            </p>
          </div>
        </motion.div>
      )}

      {/* WARNING BANNER */}
      <AnimatePresence>
        {hasWarnings && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden"
          >
            <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-start gap-4 shadow-[0_0_30px_-10px_rgba(225,29,72,0.4)]">
              <div className="p-2 bg-destructive/20 rounded-full text-destructive shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-destructive font-semibold font-display text-lg">System Alert</h3>
                <p className="text-destructive/80 text-sm mt-1">
                  {sensorData?.warnings?.temperatureHigh && "Temperature has exceeded maximum safe threshold. "}
                  {sensorData?.warnings?.humidityLow && "Humidity levels have dropped below minimum requirements."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API ERROR BANNER */}
      {isError && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex items-center gap-4">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <p className="text-warning/90 text-sm">
            Cannot reach telemetry endpoint. Retrying…
            <span className="font-mono text-xs opacity-70 ml-2">({(error as Error)?.message ?? "Network error"})</span>
          </p>
        </div>
      )}

      {/* MAIN DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: SENSORS (Spans 8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-8">
          <div className={`grid grid-cols-1 gap-6 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <SensorCard 
              title="Temperature" 
              value={sensorData?.temperature ?? null} 
              unit="°C" 
              icon={Activity} 
              colorClass="bg-rose-500" 
              isWarning={sensorData?.warnings?.temperatureHigh}
              delay={0.1}
            />
            <SensorCard 
              title="Humidity" 
              value={sensorData?.humidity ?? null} 
              unit="%" 
              icon={Droplets} 
              colorClass="bg-cyan-500"
              isWarning={sensorData?.warnings?.humidityLow}
              delay={0.2}
            />
            {/* Luminosity — Admin/Developer only (API returns null for guests anyway) */}
            {isAdmin && (
              <SensorCard 
                title="Luminosity" 
                value={sensorData?.luminosity ?? null} 
                unit="lx" 
                icon={Sun} 
                colorClass="bg-amber-400"
                delay={0.3}
              />
            )}
          </div>

          {/* Control Panel — Admin / Developer only */}
          {isAdmin && <ControlPanel />}
        </div>

        {/* RIGHT COLUMN: SETTINGS (Spans 4 cols on desktop) */}
        {/* ThresholdSettings — Admin sees it read-only; Developer can edit */}
        {isAdmin && (
          <div className="lg:col-span-4">
            <ThresholdSettings readOnly={!isDeveloper} />
          </div>
        )}

      </div>
    </div>
  );
}
