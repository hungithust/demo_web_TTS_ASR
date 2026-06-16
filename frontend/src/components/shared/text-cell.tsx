import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TextCellProps {
  text: string;
  className?: string;
}

export function TextCell({ text, className }: TextCellProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "whitespace-pre-wrap break-words text-sm leading-6 text-foreground",
          !expanded ? "overflow-hidden" : "",
        )}
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
              }
        }
      >
        {text}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="text-xs font-medium text-primary transition hover:text-primary/80"
      >
        {expanded ? "Collapse" : "Expand"}
      </button>
    </div>
  );
}
