import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div
      className={cn("flex gap-3 rounded-md px-5 py-4", className)}
      style={{
        background: "var(--vsf-red-50)",
        borderLeft: "var(--border-accent) solid var(--vsf-red-500)",
      }}
    >
      <AlertTriangle className="mt-0.5 size-4 flex-none" style={{ color: "var(--vsf-red-500)" }} />
      <div className="min-w-0 flex-1">
        <h3 className="m-0 font-display text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--vsf-red-700)" }}>
          {title}
        </h3>
        <p className="m-0 mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
          {description}
        </p>
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}
