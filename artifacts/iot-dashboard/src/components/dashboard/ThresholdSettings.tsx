  import { useState, useEffect } from "react";
  import { AlertCircle, Save, Thermometer, Droplets } from "lucide-react";
  import { GlassCard } from "../ui/glass-card";
  import {
    useGetThresholds,
    useSetThresholds,
  } from "@workspace/api-client-react";
  import { useToast } from "@/hooks/use-toast";
  import { useQueryClient } from "@tanstack/react-query";

  export function ThresholdSettings({ readOnly = false }: { readOnly?: boolean }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [tempMax, setTempMax] = useState<string>("35");
    const [humidMin, setHumidMin] = useState<string>("40");

    const { data: thresholds, isLoading } = useGetThresholds();

    const { mutate: saveThresholds, isPending } = useSetThresholds({
      mutation: {
        onSuccess: () => {
          toast({
            title: "Thresholds Updated",
            description: "Alert triggers have been successfully saved.",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/thresholds"] });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Update Failed",
            description: "Could not save thresholds to the device.",
          });
        },
      },
    });

    useEffect(() => {
      if (thresholds) {
        setTempMax(thresholds.tempMax?.toString() ?? "40");
        setHumidMin(thresholds.humidMin?.toString() ?? "30");
      }
    }, [thresholds]);

    const handleSave = () => {
      const parsedTemp = parseFloat(tempMax);
      const parsedHumid = parseFloat(humidMin);

      if (isNaN(parsedTemp) || isNaN(parsedHumid)) {
        toast({
          variant: "destructive",
          title: "Invalid Input",
          description: "Please enter valid numbers for thresholds.",
        });
        return;
      }

      saveThresholds({
        data: {
          tempMax: parsedTemp,
          humidMin: parsedHumid,
        },
      });
    };

    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
          <div className="p-2 rounded-lg bg-warning/10 text-warning">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">
              Alert Thresholds
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {readOnly
                ? "Current alert thresholds (view only)"
                : "Configure when warnings trigger"}
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Thermometer className="w-4 h-4" />
              Max Temperature (°C)
            </label>
            <input
              type="number"
              value={tempMax}
              onChange={(e) => setTempMax(e.target.value)}
              disabled={isLoading || isPending || readOnly}
              readOnly={readOnly}
              className="w-full bg-background/50 border border-border/50 text-foreground rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary block p-3 font-mono text-lg transition-all disabled:opacity-70 disabled:cursor-default"
              placeholder="e.g. 35"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Droplets className="w-4 h-4" />
              Min Humidity (%)
            </label>
            <input
              type="number"
              value={humidMin}
              onChange={(e) => setHumidMin(e.target.value)}
              disabled={isLoading || isPending || readOnly}
              readOnly={readOnly}
              className="w-full bg-background/50 border border-border/50 text-foreground rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary block p-3 font-mono text-lg transition-all disabled:opacity-70 disabled:cursor-default"
              placeholder="e.g. 40"
            />
          </div>

          {readOnly ? (
            <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/30">
              Developer role required to edit thresholds
            </p>
          ) : (
            <button
              onClick={handleSave}
              disabled={isLoading || isPending}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/50 transition-all duration-200 active:scale-[0.98]"
            >
              <Save className="w-4 h-4" />
              {isPending ? "Saving..." : "Save Configuration"}
            </button>
          )}
        </div>
      </GlassCard>
    );
  }