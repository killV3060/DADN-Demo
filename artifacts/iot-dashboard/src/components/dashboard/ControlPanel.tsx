import { useState } from "react";
import { motion } from "framer-motion";
import { Fan, Lightbulb, Power, Sliders, Settings2 } from "lucide-react";
import { GlassCard } from "../ui/glass-card";
import { useSendCommand } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ControlButtonProps {
  label: string;
  command: string;
  active?: boolean;
  onClick: (cmd: string) => void;
  isLoading: boolean;
  variant?: 'default' | 'danger' | 'success';
}

function ControlButton({ label, command, active, onClick, isLoading, variant = 'default' }: ControlButtonProps) {
  return (
    <button
      onClick={() => onClick(command)}
      disabled={isLoading}
      className={cn(
        "relative px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 border overflow-hidden",
        "disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0",
        active 
          ? "bg-primary/20 border-primary/50 text-primary shadow-[0_0_15px_-3px_rgba(var(--primary),0.3)]" 
          : "bg-background/50 border-border/50 text-foreground hover:bg-accent hover:text-accent-foreground",
        variant === 'danger' && "hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50",
        variant === 'success' && "hover:bg-success/20 hover:text-success hover:border-success/50"
      )}
    >
      {active && (
        <motion.div 
          layoutId="active-glow"
          className="absolute inset-0 bg-primary/10 blur-md -z-10" 
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

export function ControlPanel() {
  const { toast } = useToast();
  const [activeCommands, setActiveCommands] = useState<Record<string, string>>({
    servo: "2", // default closed
    led: "4",   // default off
    fan: "8",   // default off
    rgb: "10"   // default off
  });

  const { mutate: sendCommand, isPending } = useSendCommand({
    mutation: {
      onSuccess: (_, variables) => {
        const cmd = variables.data.command;
        // Optimistically update local state to show active button
        if (cmd === "1" || cmd === "2") setActiveCommands(prev => ({ ...prev, servo: cmd }));
        if (cmd === "3" || cmd === "4") setActiveCommands(prev => ({ ...prev, led: cmd }));
        if (cmd >= "5" && cmd <= "8") setActiveCommands(prev => ({ ...prev, fan: cmd }));
        if (cmd === "9" || cmd === "10") setActiveCommands(prev => ({ ...prev, rgb: cmd }));
        
        toast({
          title: "Command Sent",
          description: `Successfully sent command: ${cmd}`,
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Command Failed",
          description: error.error?.error || "Failed to communicate with device",
        });
      }
    }
  });

  const handleCommand = (cmd: string) => {
    sendCommand({ data: { command: cmd } });
  };

  return (
    <GlassCard className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Settings2 className="w-5 h-5" />
        </div>
        <h2 className="font-display text-xl font-semibold">Device Controls</h2>
      </div>

      <div className="space-y-6 flex-1">
        {/* Servo Control */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sliders className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Servo Motor</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ControlButton label="Open" command="1" active={activeCommands.servo === "1"} onClick={handleCommand} isLoading={isPending} />
            <ControlButton label="Close" command="2" active={activeCommands.servo === "2"} onClick={handleCommand} isLoading={isPending} />
          </div>
        </div>

        {/* LED Control */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lightbulb className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Main LED</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ControlButton label="Turn On" command="3" active={activeCommands.led === "3"} onClick={handleCommand} isLoading={isPending} variant="success" />
            <ControlButton label="Turn Off" command="4" active={activeCommands.led === "4"} onClick={handleCommand} isLoading={isPending} variant="danger" />
          </div>
        </div>

        {/* Fan Control */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Fan className={cn("w-4 h-4", activeCommands.fan !== "8" && "animate-spin text-primary")} />
            <span className="text-sm font-medium uppercase tracking-wider">Cooling Fan</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <ControlButton label="33%" command="5" active={activeCommands.fan === "5"} onClick={handleCommand} isLoading={isPending} />
            <ControlButton label="66%" command="6" active={activeCommands.fan === "6"} onClick={handleCommand} isLoading={isPending} />
            <ControlButton label="MAX" command="7" active={activeCommands.fan === "7"} onClick={handleCommand} isLoading={isPending} />
            <ControlButton label="OFF" command="8" active={activeCommands.fan === "8"} onClick={handleCommand} isLoading={isPending} variant="danger" />
          </div>
        </div>

        {/* RGB Control */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Power className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">RGB Strip</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ControlButton label="Power On" command="9" active={activeCommands.rgb === "9"} onClick={handleCommand} isLoading={isPending} variant="success" />
            <ControlButton label="Power Off" command="10" active={activeCommands.rgb === "10"} onClick={handleCommand} isLoading={isPending} variant="danger" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
