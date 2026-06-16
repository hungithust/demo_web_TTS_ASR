import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title, action, className }: ErrorStateProps) {
  return (
    <div className={cn("rounded-3xl border border-rose-200 bg-rose-50 p-5 sm:p-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="size-4" />
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          </div>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
