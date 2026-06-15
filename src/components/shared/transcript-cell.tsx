import { cn } from "@/lib/utils";

export interface TranscriptCellProps {
  text: string;
  className?: string;
}

export function TranscriptCell({ text, className }: TranscriptCellProps) {
  return (
    <div className={cn("whitespace-pre-wrap break-words text-sm leading-6 text-foreground", className)}>
      {text}
    </div>
  );
}
