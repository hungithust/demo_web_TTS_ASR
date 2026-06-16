import type { PropsWithChildren } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingOverlayProps extends PropsWithChildren {
  visible: boolean;
  className?: string;
  overlayClassName?: string;
}

export function LoadingOverlay({
  visible,
  className,
  overlayClassName,
  children,
}: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {visible ? (
        <div
          className={cn(
            "absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-background/70 backdrop-blur-sm",
            overlayClassName,
          )}
        >
          <div className="inline-flex items-center justify-center rounded-2xl border border-border bg-card p-2 shadow-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
