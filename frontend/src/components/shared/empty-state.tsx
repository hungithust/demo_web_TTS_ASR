import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ className }: EmptyStateProps) {
  return <div className={cn("min-h-16 rounded-3xl border border-dashed border-border bg-background/40", className)} />;
}
