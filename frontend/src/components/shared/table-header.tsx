import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TableHeaderProps {
  className?: string;
  children: ReactNode;
}

export function TableHeader({ className, children }: TableHeaderProps) {
  return (
    <thead className={cn("[&_th]:sticky [&_th]:top-0 [&_th]:z-10", className)}>
      {children}
    </thead>
  );
}
