import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export interface ComparisonTableProps extends PropsWithChildren {
  caption?: string;
  className?: string;
  tableClassName?: string;
}

export function ComparisonTable({
  caption,
  className,
  tableClassName,
  children,
}: ComparisonTableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-3xl border border-border bg-card", className)}>
      <table className={cn("min-w-[720px] w-full table-fixed border-separate border-spacing-0 md:min-w-full", tableClassName)}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export interface ComparisonTableHeadProps extends PropsWithChildren {
  className?: string;
}

export function ComparisonTableHead({ className, children }: ComparisonTableHeadProps) {
  return <thead className={cn("[&_th]:sticky [&_th]:top-0 [&_th]:z-10", className)}>{children}</thead>;
}

export interface ComparisonTableBodyProps extends PropsWithChildren {
  className?: string;
}

export function ComparisonTableBody({ className, children }: ComparisonTableBodyProps) {
  return <tbody className={className}>{children}</tbody>;
}

export interface ComparisonTableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  className?: string;
}

export function ComparisonTableRow({ className, ...props }: ComparisonTableRowProps) {
  return <tr className={cn("align-top transition-colors hover:bg-muted/35", className)} {...props} />;
}

export interface ComparisonTableHeaderCellProps extends PropsWithChildren {
  className?: string;
}

export function ComparisonTableHeaderCell({
  className,
  children,
}: ComparisonTableHeaderCellProps) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border bg-background/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur",
        className,
      )}
    >
      {children}
    </th>
  );
}

export interface ComparisonTableCellProps extends PropsWithChildren {
  className?: string;
}

export function ComparisonTableCell({ className, children }: ComparisonTableCellProps) {
  return <td className={cn("border-b border-border px-4 py-4 align-top", className)}>{children}</td>;
}

export interface ComparisonColumnLabelProps {
  label: string;
  description?: string;
}

export function ComparisonColumnLabel({ label, description }: ComparisonColumnLabelProps) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold tracking-tight text-foreground">{label}</div>
      {description ? <div className="text-xs font-normal normal-case tracking-normal text-muted-foreground">{description}</div> : null}
    </div>
  );
}
