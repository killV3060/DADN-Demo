import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { GlassCard } from "../ui/glass-card";
import { cn } from "@/lib/utils";

interface SensorCardProps {
  title: string;
  value: number | null;
  unit: string;
  icon: LucideIcon;
  colorClass: string;
  isWarning?: boolean;
  delay?: number;
}

export function SensorCard({
  title,
  value,
  unit,
  icon: Icon,
  colorClass,
  isWarning = false,
  delay = 0,
}: SensorCardProps) {
  const displayValue = value !== null ? value.toFixed(1) : "--";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <GlassCard className={cn(
        "relative overflow-hidden p-6 h-full flex flex-col justify-between",
        isWarning && "border-destructive/50 bg-destructive/10 shadow-[0_0_30px_-5px_rgba(225,29,72,0.3)]"
      )}>
        {/* Background Accent */}
        <div className={cn(
          "absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none",
          colorClass,
          isWarning && "bg-destructive opacity-30"
        )} />

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-muted-foreground tracking-wider uppercase text-sm">
            {title}
          </h3>
          <div className={cn(
            "p-2 rounded-xl bg-background/50 border border-border/50",
            isWarning ? "text-destructive" : colorClass.replace("bg-", "text-")
          )}>
            <Icon className="w-5 h-5" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mt-4">
          <span className="font-mono text-5xl font-bold text-gradient">
            {displayValue}
          </span>
          <span className="font-mono text-xl text-muted-foreground font-medium">
            {unit}
          </span>
        </div>

        {isWarning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 inline-flex items-center text-xs font-medium text-destructive bg-destructive/10 px-3 py-1 rounded-full border border-destructive/20 w-fit"
          >
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
            </span>
            Critical Level
          </motion.div>
        )}
      </GlassCard>
    </motion.div>
  );
}
