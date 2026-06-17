import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionContainerProps extends PropsWithChildren {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionContainer({
  title,
  action,
  className,
  children,
}: SectionContainerProps) {
  return (
    <section className={cn("space-y-4 sm:space-y-5", className)}>
      {title || action ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>{title ? <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2> : null}</div>
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
