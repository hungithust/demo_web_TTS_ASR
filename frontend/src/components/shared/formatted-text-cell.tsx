import { cn } from "@/lib/utils";

export interface FormattedTextCellProps {
  text: string;
  className?: string;
}

export function FormattedTextCell({ text, className }: FormattedTextCellProps) {
  return (
    <div className={cn("whitespace-pre-wrap break-words text-sm leading-6 text-foreground", className)}>
      {text}
    </div>
  );
}
