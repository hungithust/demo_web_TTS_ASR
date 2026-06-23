import { cn } from "@/lib/utils";

export interface ScoreSelectorProps {
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  ariaLabel?: string;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

function formatScore(score: number) {
  return score % 1 === 0 ? `${score}` : score.toFixed(1);
}

function buildScores(min: number, max: number, step: number) {
  const scores: number[] = [];
  const precision = step % 1 === 0 ? 0 : `${step}`.split(".")[1].length;
  const safeStep = step > 0 ? step : 1;
  for (let current = min; current <= max + safeStep / 2; current += safeStep) {
    scores.push(Number(current.toFixed(precision)));
  }
  return scores;
}

export function ScoreSelector({
  value,
  onChange,
  min = 0,
  max = 5,
  step = 0.5,
  label = "Score",
  ariaLabel = "Score selection",
  formatValue = formatScore,
  disabled = false,
  className,
}: ScoreSelectorProps) {
  const scores = buildScores(min, max, step);

  return (
    <div className={cn("mx-auto w-full max-w-3xl space-y-3", className)}>
      <div className="flex items-center justify-center gap-2 text-base font-semibold text-foreground sm:text-lg">
        <span className="text-muted-foreground">{label}:</span>
        <span className="tabular-nums">{value === null ? "--" : formatValue(value)}</span>
      </div>

      <div
        role="group"
        aria-label={ariaLabel}
        className="flex flex-wrap justify-center gap-2 rounded-md border border-border bg-card px-3 py-4 shadow-sm"
      >
        {scores.map((score) => {
          const active = value === score;
          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(score)}
              className={cn(
                "min-w-12 rounded-md border px-3 py-2 text-sm font-semibold tabular-nums transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                disabled && "cursor-not-allowed opacity-60",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              {formatValue(score)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
