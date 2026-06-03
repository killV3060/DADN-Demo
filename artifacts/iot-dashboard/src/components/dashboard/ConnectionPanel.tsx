import { useState, useEffect } from "react";
import { Link2, Link2Off, RefreshCw, Usb } from "lucide-react";
import { GlassCard } from "../ui/glass-card";
import { 
  useGetConnectionStatus, 
  useListSerialPorts, 
  useConnectDevice 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DashboardScope {
  mode: "demo" | "serial" | "wifi";
  serialPort: string;
  wifiDeviceId: string;
}

interface ConnectionPanelProps {
  scope: DashboardScope;
  scopeLabel: string;
  onScopeChange: (scope: DashboardScope) => void;
  /** Read-only status view for authenticated users without connection management. */
  readOnly?: boolean;
}

const WIFI_DEVICE_OPTIONS = ["device1", "device2", "device3"];

export function ConnectionPanel({ scope, scopeLabel, onScopeChange, readOnly = false }: ConnectionPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useGetConnectionStatus({
    query: { 
      queryKey: ['sensor-data'],
      refetchInterval: 5000 } // Poll status every 5s
  });

  const { data: portsData, refetch: refetchPorts, isFetching: fetchingPorts } = useListSerialPorts({
    query: { enabled: !readOnly },
  });

  const { mutate: connect, isPending: isConnecting } = useConnectDevice({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Connection Status",
          description: data.connected ? `Connected to ${data.port}` : "Disconnected",
          variant: data.connected ? "default" : "destructive"
        });
        queryClient.invalidateQueries({ queryKey: ["/api/connection"] });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: (error as any).error || "Unknown error occurred" //khá căng thẳng đoạn này tại chưa biết cấu hình error sao
        });
      }
    }
  });

  // Update selected port if currently connected
  useEffect(() => {
    if (scope.mode === "wifi") {
      return;
    }

    if (status?.connected && status.port) {
      onScopeChange({
        ...scope,
        mode: status.mode === "demo" ? "demo" : "serial",
        serialPort: status.port,
      });
    }
  }, [status, scope, onScopeChange]);

  const handleConnect = () => {
    if (scope.mode === "wifi") {
      toast({
        title: "WiFi View Enabled",
        description: `Selected ${scopeLabel}. Devices can be surfaced from MQTT topics later.`,
      });
      return;
    }

    connect({ data: { port: scope.mode === "serial" ? scope.serialPort : "demo" } });
  };

  const isConnected = status?.connected ?? false;
  const isWifiMode = scope.mode === "wifi";
  const deviceOptions = WIFI_DEVICE_OPTIONS.includes(scope.wifiDeviceId)
    ? WIFI_DEVICE_OPTIONS
    : [...WIFI_DEVICE_OPTIONS, scope.wifiDeviceId];

  return (
    <GlassCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center border",
          isConnected || isWifiMode
            ? "bg-success/10 border-success/30 text-success shadow-[0_0_20px_-5px_rgba(var(--success),0.4)]" 
            : "bg-muted border-border text-muted-foreground"
        )}>
          {isConnected || isWifiMode ? <Link2 className="w-6 h-6" /> : <Link2Off className="w-6 h-6" />}
        </div>
        
        <div>
          <h3 className="font-display font-medium text-lg flex items-center gap-2">
            Device Status
            <span className={cn(
              "w-2 h-2 rounded-full",
              isConnected || isWifiMode ? "bg-success animate-pulse" : "bg-destructive"
            )} />
          </h3>
          <p className="text-sm text-muted-foreground font-mono">
            {isWifiMode
              ? `Viewing ${scopeLabel}`
              : statusLoading
                ? "Checking..."
                : (isConnected ? `Connected via ${status?.mode} mode` : "Offline")}
          </p>
        </div>
      </div>

      {!readOnly && (
      <div className="flex flex-col gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <select 
              value={scope.mode}
              onChange={(e) => onScopeChange({
                ...scope,
                mode: e.target.value === "wifi" ? "wifi" : e.target.value === "serial" ? "serial" : "demo",
              })}
              disabled={isConnecting}
              className="w-full bg-background/50 border border-border/50 text-foreground text-sm rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary block p-2.5 appearance-none disabled:opacity-50"
            >
              <option value="demo">Demo</option>
              <option value="wifi">Wifi</option>
              <option value="serial">Serial</option>
            </select>
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting || statusLoading}
            className={cn(
              "px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border",
              isConnected || isWifiMode
                ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                : "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            )}
          >
            {isWifiMode ? "Open View" : isConnecting ? "..." : (isConnected ? "Disconnect" : "Connect")}
          </button>
        </div>

        {scope.mode === "wifi" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto min-w-0 sm:min-w-[20rem]">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
                <Usb className="w-4 h-4" />
              </div>
              <select
                value={scope.wifiDeviceId}
                onChange={(e) => onScopeChange({ ...scope, wifiDeviceId: e.target.value })}
                className="w-full bg-background/50 border border-border/50 text-foreground text-sm rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary block pl-10 p-2.5 appearance-none"
              >
                {deviceOptions.map((deviceId) => (
                  <option key={deviceId} value={deviceId}>
                    Wifi ({deviceId})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-muted-foreground flex items-center px-3 py-2 rounded-xl border border-border/50 bg-background/40">
              Query params can share this view as <span className="font-mono ml-1">?mode=wifi&device={scope.wifiDeviceId}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
                <Usb className="w-4 h-4" />
              </div>
              <select 
                value={scope.serialPort}
                onChange={(e) => onScopeChange({ ...scope, serialPort: e.target.value })}
                disabled={isConnected || isConnecting}
                className="w-full bg-background/50 border border-border/50 text-foreground text-sm rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary block pl-10 p-2.5 appearance-none disabled:opacity-50"
              >
                <option value="demo">Demo Mode (Simulation)</option>
                {portsData?.ports?.map(port => (
                  <option key={port} value={port}>{port}</option>
                )) || null }
              </select>
            </div>
            
            <button
              onClick={() => refetchPorts()}
              disabled={fetchingPorts || isConnected}
              className="p-2.5 rounded-xl border border-border/50 bg-background/50 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
              title="Refresh Ports"
            >
              <RefreshCw className={cn("w-4 h-4", fetchingPorts && "animate-spin")} />
            </button>
          </div>
        )}
      </div>
      )}
    </GlassCard>
  );
}
