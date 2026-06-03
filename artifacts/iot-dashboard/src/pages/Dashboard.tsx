import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useGetSensorData, useGetConnectionStatus } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Activity, Droplets, LogIn, LogOut, Sun, AlertTriangle, Cpu, UserCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { SensorCard } from "@/components/dashboard/SensorCard";
import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { ConnectionPanel } from "@/components/dashboard/ConnectionPanel";
import { ThresholdSettings } from "@/components/dashboard/ThresholdSettings";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useAuth } from "@/contexts/AuthContext";
import VoiceControl from "@/components/dashboard/VoiceControl";

type DashboardMode = "demo" | "serial" | "wifi";

interface DashboardScope {
  mode: DashboardMode;
  serialPort: string;
  wifiDeviceId: string;
}

const DEFAULT_SCOPE: DashboardScope = {
  mode: "demo",
  serialPort: "demo",
  wifiDeviceId: "device1",
};

const SCOPE_STORAGE_KEY = "iot-dashboard-scope";

function buildScopeLabel(scope: DashboardScope): string {
  if (scope.mode === "wifi") {
    return `Wifi (${scope.wifiDeviceId})`;
  }

  if (scope.mode === "serial") {
    return scope.serialPort ? `Serial (${scope.serialPort})` : "Serial";
  }

  return "Demo";
}

function readInitialScope(): DashboardScope {
  if (typeof window === "undefined") {
    return DEFAULT_SCOPE;
  }

  const params = new URLSearchParams(window.location.search);
  const storedScope = window.localStorage.getItem(SCOPE_STORAGE_KEY);

  let fallbackScope: DashboardScope = DEFAULT_SCOPE;

  if (storedScope) {
    try {
      fallbackScope = { ...DEFAULT_SCOPE, ...JSON.parse(storedScope) };
    } catch {
      fallbackScope = DEFAULT_SCOPE;
    }
  }

  const modeParam = params.get("mode");
  const serialPortParam = params.get("port");
  const wifiDeviceIdParam = params.get("device");

  const mode = modeParam === "wifi" || modeParam === "serial" || modeParam === "demo"
    ? modeParam
    : fallbackScope.mode;

  return {
    mode,
    serialPort: serialPortParam ?? fallbackScope.serialPort,
    wifiDeviceId: wifiDeviceIdParam ?? fallbackScope.wifiDeviceId,
  };
}

export default function Dashboard() {
  const { role, user, isAuthenticated, logout, can } = useAuth();
  const isGuest = role === "guest";
  const [scope, setScope] = useState<DashboardScope>(() => readInitialScope());

  const { data: sensorData, isError, error } = useGetSensorData({
    query: {
      queryKey: ["sensor-data", scope.mode, scope.mode === "wifi" ? scope.wifiDeviceId : scope.serialPort, role],
      refetchInterval: 1000,
      retry: 2,
    },
    request: {
      query: scope.mode === "wifi"
        ? { source: scope.wifiDeviceId }
        : scope.mode === "serial"
          ? { source: scope.serialPort }
          : { source: "demo" },
    },
  });

  const { data: connectionData } = useGetConnectionStatus({
    query: {
      enabled: can("view:connection"),
      refetchInterval: can("view:connection") ? 5000 : false,
    },
  });

  const hasWarnings =
    !isGuest &&
    (sensorData?.warnings?.temperatureHigh || sensorData?.warnings?.humidityLow);
  const isConnected = connectionData?.connected;
  const scopeLabel = buildScopeLabel(scope);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(scope));

    const params = new URLSearchParams(window.location.search);
    params.set("mode", scope.mode);

    if (scope.mode === "wifi") {
      params.set("device", scope.wifiDeviceId);
      params.delete("port");
    } else {
      params.set("port", scope.mode === "serial" ? scope.serialPort : "demo");
      params.delete("device");
    }

    const search = params.toString();
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, [scope]);

  const formattedTime = sensorData?.timestamp
    ? format(new Date(sensorData.timestamp), "HH:mm:ss.SSS")
    : "--:--:--";

  return (
    <div className="min-h-screen pb-12 pt-6 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-8">

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
          <p className="text-muted-foreground ml-14">IoT Telemetry & Control Center</p>
          <div className="ml-14 mt-3 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="uppercase tracking-wider">Role</span>
            <span className="font-mono text-foreground capitalize">{role}</span>
            {user && (
              <>
                <span className="text-border">|</span>
                <UserCircle2 className="w-3.5 h-3.5" />
                <span className="font-mono text-foreground">{user.username}</span>
              </>
            )}
          </div>
          {!isGuest && (
            <div className="ml-14 mt-2 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="uppercase tracking-wider">Viewing</span>
              <span className="font-mono text-foreground">{scopeLabel}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:items-end gap-3">
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-4 py-2 text-sm hover:bg-accent"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary hover:bg-primary/20"
              >
                <LogIn className="w-4 h-4" />
                Sign in
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3 bg-card/40 backdrop-blur-sm border border-border/50 px-4 py-2 rounded-full">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Last Sync</span>
              <span className="font-mono font-medium text-foreground">{formattedTime}</span>
            </div>
            {can("view:connection") && (
              <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-success animate-pulse" : "bg-muted"} shadow-[0_0_10px_rgba(var(--success),0.5)]`} />
            )}
          </div>
        </div>
      </header>

      <RoleGuard permission="view:connection">
        <ConnectionPanel
          scope={scope}
          scopeLabel={scopeLabel}
          onScopeChange={setScope}
          readOnly={!can("manage:connection")}
        />
      </RoleGuard>

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

      {isError && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex items-center gap-4">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <p className="text-warning/90 text-sm">
            Cannot reach telemetry endpoint. Retrying...
            <span className="font-mono text-xs opacity-70 ml-2">
              ({error instanceof Error ? error.message : "Network error"})
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className={`space-y-8 ${isGuest ? "lg:col-span-12" : "lg:col-span-8"}`}>
          <div className={`grid gap-6 ${isGuest ? "grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto" : "grid-cols-1 md:grid-cols-3"}`}>
            <SensorCard
              title="Temperature"
              value={sensorData?.temperature ?? null}
              unit="°C"
              icon={Activity}
              colorClass="bg-rose-500"
              isWarning={!isGuest && sensorData?.warnings?.temperatureHigh}
              delay={0.1}
            />
            <SensorCard
              title="Humidity"
              value={sensorData?.humidity ?? null}
              unit="%"
              icon={Droplets}
              colorClass="bg-cyan-500"
              isWarning={!isGuest && sensorData?.warnings?.humidityLow}
              delay={0.2}
            />
            <RoleGuard minRole="user">
              <SensorCard
                title="Luminosity"
                value={sensorData?.luminosity ?? null}
                unit="lx"
                icon={Sun}
                colorClass="bg-amber-400"
                delay={0.3}
              />
            </RoleGuard>
          </div>

          <RoleGuard permission="control:device">
            <ControlPanel scopeLabel={scopeLabel} />
            <VoiceControl scopeLabel={scopeLabel} />
          </RoleGuard>
        </div>

        <RoleGuard permission="view:thresholds">
          <div className="lg:col-span-4">
            <ThresholdSettings scopeLabel={scopeLabel} />
          </div>
        </RoleGuard>

      </div>
    </div>
  );
}
