import { cn } from "@/lib/utils";

export interface OptionToggleOption<T extends string> {
  label: string;
  value: T;
}

export interface OptionToggleProps<T extends string> {
  label?: string;
  value: T;
  options: OptionToggleOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

export function OptionToggle<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: OptionToggleProps<T>) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      ) : null}
      <div className="flex gap-1 rounded-[9px] p-1" style={{ background: "var(--surface-sunken)" }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex-1 rounded-md border-none px-1 py-[9px] text-center font-display text-sm font-bold transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              style={active ? { background: "var(--vsf-red-500)", color: "#fff" } : { background: "transparent", color: "var(--text-secondary)" }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
