import { cn } from "@/lib/utils";
import type { DebugInfo } from "@/types/debug.types";

const STAT_HANDLED = new Set(["latency_ms", "duration_sec", "sample_rate", "model"]);
const LINE_ORDER = ["model", "voice", "response_format", "speed", "enable_norm", "normalized_text"];

function lineValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}

export function DebugInfoPanel({ info, className }: { info: DebugInfo; className?: string }) {
  const stats: Array<{ label: string; value: string; brand?: boolean; small?: boolean }> = [];
  if (info.latency_ms !== undefined && info.latency_ms !== null) {
    stats.push({ label: "latency_ms", value: String(info.latency_ms), brand: true });
  }
  if (info.duration_sec !== undefined && info.duration_sec !== null) {
    stats.push({ label: "duration_sec", value: String(info.duration_sec) });
  }

  let modelShownAsStat = false;
  if (info.sample_rate !== undefined && info.sample_rate !== null) {
    stats.push({ label: "sample_rate", value: String(info.sample_rate) });
  } else if (info.model) {
    stats.push({ label: "model", value: String(info.model), small: true });
    modelShownAsStat = true;
  }

  const lineKeys = [
    ...LINE_ORDER.filter((key) => {
      if (key === "model" && modelShownAsStat) return false;
      return info[key] !== undefined && info[key] !== null && info[key] !== "";
    }),
    ...Object.keys(info).filter(
      (key) =>
        !STAT_HANDLED.has(key) &&
        !LINE_ORDER.includes(key) &&
        info[key] !== undefined &&
        info[key] !== null &&
        info[key] !== "",
    ),
  ];

  return (
    <div className={cn("rounded-md p-[18px]", className)} style={{ border: "1px solid var(--border-subtle)", background: "var(--surface-page)" }}>
      <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
        Debug info
      </div>

      {stats.length > 0 ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: lineKeys.length > 0 ? 16 : 0 }}>
          {stats.map((stat) => (
            <div key={stat.label} className="vsf-stat">
              <span className="vsf-stat__label">{stat.label}</span>
              <span className={cn("vsf-stat__value", stat.brand && "vsf-stat__value--brand")} style={stat.small ? { fontSize: "17px", wordBreak: "break-word" } : undefined}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {lineKeys.length > 0 ? (
        <div
          className="flex flex-col gap-[7px] font-mono text-[12.5px]"
          style={{
            color: "var(--text-secondary)",
            borderTop: stats.length > 0 ? "1px solid var(--border-subtle)" : undefined,
            paddingTop: stats.length > 0 ? 14 : 0,
          }}
        >
          {lineKeys.map((key) => (
            <div key={key} className="flex gap-1.5">
              <span className="flex-none">{key}:</span>
              <b style={{ color: "var(--text-primary)", fontWeight: 500, wordBreak: "break-word" }}>
                {lineValue(key, info[key])}
              </b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
