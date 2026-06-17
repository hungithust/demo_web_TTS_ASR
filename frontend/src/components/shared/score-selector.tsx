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

function getPrecision(step: number) {
  const raw = `${step}`;
  return raw.includes(".") ? raw.split(".")[1].length : 0;
}

function snapToStep(value: number, min: number, max: number, step: number) {
  const precision = getPrecision(step);
  const safeStep = step > 0 ? step : 1;
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = Math.round((clamped - min) / safeStep) * safeStep + min;

  return Number(snapped.toFixed(precision));
}

function formatScore(score: number) {
  return score % 1 === 0 ? `${score}` : score.toFixed(1);
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
  const displayValue = value ?? min;
  const displayText = value === null ? "--" : formatValue(value);
  const percent = ((displayValue - min) / (max - min || 1)) * 100;

  return (
    <div className={cn("mx-auto w-full max-w-lg space-y-3", className)}>
      <div className="flex items-center justify-center gap-2 text-base font-semibold text-foreground sm:text-lg">
        <span className="text-muted-foreground">{label}:</span>
        <span className="tabular-nums">{displayText}</span>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          aria-label={ariaLabel}
          disabled={disabled}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            onChange(snapToStep(nextValue, min, max, step));
          }}
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percent}%, hsl(var(--muted)) ${percent}%, hsl(var(--muted)) 100%)`,
          }}
          className={cn(
            "h-3 w-full cursor-pointer appearance-none rounded-full bg-transparent outline-none transition",
            "focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition [&::-webkit-slider-thumb]:duration-150 hover:[&::-webkit-slider-thumb]:scale-105 focus-visible:[&::-webkit-slider-thumb]:scale-110 focus-visible:[&::-webkit-slider-thumb]:shadow-lg",
            "[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
            "[&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:transition [&::-moz-range-thumb]:duration-150",
            "hover:[&::-moz-range-thumb]:scale-105 focus-visible:[&::-moz-range-thumb]:scale-110 focus-visible:[&::-moz-range-thumb]:shadow-lg",
          )}
        />

        <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center text-sm text-muted-foreground">
          <span className="text-base font-bold tabular-nums text-foreground">{formatValue(min)}</span>
          <span className="justify-self-center text-xs font-medium tabular-nums text-muted-foreground">
            {formatValue((min + max) / 2)}
        </span>
          <span className="justify-self-end text-base font-bold tabular-nums text-foreground">{formatValue(max)}</span>
        </div>
      </div>
    </div>
  );
}
