import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow = "AI Demo Playground",
  action,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-4 rounded-md border border-border bg-card p-6 shadow-soft", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
