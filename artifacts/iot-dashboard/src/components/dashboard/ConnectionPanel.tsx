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

export function ConnectionPanel() {
  const [selectedPort, setSelectedPort] = useState<string>("demo");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useGetConnectionStatus({
    query: { refetchInterval: 5000 } // Poll status every 5s
  });

  const { data: portsData, refetch: refetchPorts, isFetching: fetchingPorts } = useListSerialPorts();

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
          description: error.error?.error || "Unknown error occurred"
        });
      }
    }
  });

  // Update selected port if currently connected
  useEffect(() => {
    if (status?.connected && status.port) {
      setSelectedPort(status.port);
    }
  }, [status]);

  const handleConnect = () => {
    connect({ data: { port: selectedPort } });
  };

  const isConnected = status?.connected ?? false;

  return (
    <GlassCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center border",
          isConnected 
            ? "bg-success/10 border-success/30 text-success shadow-[0_0_20px_-5px_rgba(var(--success),0.4)]" 
            : "bg-muted border-border text-muted-foreground"
        )}>
          {isConnected ? <Link2 className="w-6 h-6" /> : <Link2Off className="w-6 h-6" />}
        </div>
        
        <div>
          <h3 className="font-display font-medium text-lg flex items-center gap-2">
            Device Status
            <span className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-success animate-pulse" : "bg-destructive"
            )} />
          </h3>
          <p className="text-sm text-muted-foreground font-mono">
            {statusLoading ? "Checking..." : (isConnected ? `Connected via ${status?.mode} mode` : "Offline")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:w-48">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
            <Usb className="w-4 h-4" />
          </div>
          <select 
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={isConnected || isConnecting}
            className="w-full bg-background/50 border border-border/50 text-foreground text-sm rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary block pl-10 p-2.5 appearance-none disabled:opacity-50"
          >
            <option value="demo">Demo Mode (Simulation)</option>
            {portsData?.ports.map(port => (
              <option key={port} value={port}>{port}</option>
            ))}
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

        <button
          onClick={handleConnect}
          disabled={isConnecting || statusLoading}
          className={cn(
            "px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border",
            isConnected 
              ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20" 
              : "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          )}
        >
          {isConnecting ? "..." : (isConnected ? "Disconnect" : "Connect")}
        </button>
      </div>
    </GlassCard>
  );
}
