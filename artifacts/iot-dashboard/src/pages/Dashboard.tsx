import { useGetSensorData, useGetConnectionStatus } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Activity, Droplets, Sun, AlertTriangle, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { SensorCard } from "@/components/dashboard/SensorCard";
import { ControlPanel } from "@/components/dashboard/ControlPanel";
import { ConnectionPanel } from "@/components/dashboard/ConnectionPanel";
import { ThresholdSettings } from "@/components/dashboard/ThresholdSettings";

export default function Dashboard() {
  const { data: sensorData, isError, error } = useGetSensorData({
    query: { 
      queryKey: ['sensor-data'],
      refetchInterval: 1000,
      retry: 2
    }
  });
  
  const { data: connectionData } = useGetConnectionStatus();

  const hasWarnings = sensorData?.warnings?.temperatureHigh || sensorData?.warnings?.humidityLow;
  const isConnected = connectionData?.connected;

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
          <p className="text-muted-foreground ml-14">IoT Telemetry & Control Center</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card/40 backdrop-blur-sm border border-border/50 px-4 py-2 rounded-full">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Last Sync</span>
            <span className="font-mono font-medium text-foreground">{formattedTime}</span>
          </div>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-muted'} shadow-[0_0_10px_rgba(var(--success),0.5)]`} />
        </div>
      </header>

      {/* CONNECTION PANEL */}
      <ConnectionPanel />

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
             Cannot reach telemetry endpoint. Retrying... 
             <span className="font-mono text-xs opacity-70 ml-2">({(error as any)?.message || 'Network error'})</span>
           </p>
         </div>
      )}

      {/* MAIN DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: SENSORS (Spans 8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <SensorCard 
              title="Luminosity" 
              value={sensorData?.luminosity ?? null} 
              unit="lx" 
              icon={Sun} 
              colorClass="bg-amber-400"
              delay={0.3}
            />
          </div>

          <ControlPanel />
        </div>

        {/* RIGHT COLUMN: SETTINGS (Spans 4 cols on desktop) */}
        <div className="lg:col-span-4">
          <ThresholdSettings />
        </div>

      </div>
    </div>
  );
}
