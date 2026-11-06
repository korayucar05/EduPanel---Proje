import { reportChartColors, reportPalette } from "./reportPalette";

export const chartTheme = {
  colors: reportChartColors,
  grid: "#dbe5f1",
  axis: "#94a3b8",
  label: "#475569",
  value: "#082f58",
  background: "#f8fbff",
  success: reportPalette.green,
  warning: reportPalette.amber,
  risk: reportPalette.rose,
} as const;

export function performanceTone(value:number){
  if(value>=75)return "success" as const;
  if(value>=55)return "warning" as const;
  return "risk" as const;
}

export function performanceColor(value:number){
  const tone=performanceTone(value);
  return tone==="success"
    ? chartTheme.success
    : tone==="warning"
      ? chartTheme.warning
      : chartTheme.risk;
}
