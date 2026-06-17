import { cn } from "@/lib/utils";
import type { ComparisonChoice } from "@/types/eval.types";

export type { ComparisonChoice } from "@/types/eval.types";

export interface ComparisonSelectorProps {
  value: ComparisonChoice | null;
  onChange: (value: ComparisonChoice) => void;
  disabled?: boolean;
  className?: string;
}

const choices: Array<{ value: ComparisonChoice; label: string }> = [
  { value: "A", label: "A better" },
  { value: "same", label: "Same" },
  { value: "B", label: "B better" },
];

export function ComparisonSelector({
  value,
  onChange,
  disabled = false,
  className,
}: ComparisonSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Comparison selection" className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {choices.map((choice) => {
        const active = value === choice.value;

        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(choice.value)}
            className={cn(
              "inline-flex h-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-foreground hover:bg-muted",
              disabled ? "cursor-not-allowed opacity-50" : "",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
