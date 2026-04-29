import { Wifi, WifiOff, MonitorPlay } from "lucide-react";
import { GlassCard } from "../ui/glass-card";
import {
  useGetConnectionStatus,
  useConnectDevice,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ConnectionPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useGetConnectionStatus({
    query: {
      refetchInterval: 5000,
    },
  });

  const { mutate: connect, isPending: isConnecting } = useConnectDevice({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Connection Updated",
          description: data.connected
            ? `Connected via ${data.mode} mode`
            : "Disconnected",
          variant: data.connected ? "default" : "destructive",
        });
        void queryClient.invalidateQueries({ queryKey: ["/api/connection"] });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: (error as { error?: string }).error ?? "Unknown error occurred",
        });
      },
    },
  });

  const isConnected = status?.connected ?? false;
  const currentMode = status?.mode ?? null;

  const handleConnect = (mode: "demo" | "mqtt") => {
    connect({ data: { mode } });
  };

  const ModeIcon = currentMode === "mqtt" ? Wifi : currentMode === "demo" ? MonitorPlay : WifiOff;

  return (
    <GlassCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center border",
            isConnected
              ? "bg-success/10 border-success/30 text-success shadow-[0_0_20px_-5px_rgba(var(--success),0.4)]"
              : "bg-muted border-border text-muted-foreground",
          )}
        >
          <ModeIcon className="w-6 h-6" />
        </div>

        <div>
          <h3 className="font-display font-medium text-lg flex items-center gap-2">
            Device Status
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-success animate-pulse" : "bg-destructive",
              )}
            />
          </h3>
          <p className="text-sm text-muted-foreground font-mono">
            {statusLoading
              ? "Checking..."
              : isConnected
                ? currentMode === "mqtt"
                  ? `MQTT — ${status?.port ?? "broker"}`
                  : "Demo Mode (simulated data)"
                : "Offline"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          onClick={() => handleConnect("demo")}
          disabled={isConnecting || statusLoading || currentMode === "demo"}
          className={cn(
            "flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border",
            currentMode === "demo"
              ? "bg-primary/20 border-primary/50 text-primary"
              : "bg-background/50 border-border/50 text-foreground hover:bg-accent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <MonitorPlay className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Demo
        </button>

        <button
          onClick={() => handleConnect("mqtt")}
          disabled={isConnecting || statusLoading || currentMode === "mqtt"}
          className={cn(
            "flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border",
            currentMode === "mqtt"
              ? "bg-success/10 border-success/30 text-success"
              : "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
          )}
        >
          <Wifi className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          {isConnecting ? "..." : "MQTT"}
        </button>
      </div>
    </GlassCard>
  );
}
