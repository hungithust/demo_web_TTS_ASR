import { cn } from "@/lib/utils";

export interface SwitchRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  divider?: boolean;
  className?: string;
}

export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  divider = false,
  className,
}: SwitchRowProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3", className)}
      style={divider ? { borderTop: "1px solid var(--border-subtle)", paddingTop: 15 } : undefined}
    >
      <div>
        <div className="vsf-field__label">{label}</div>
        {description ? <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{description}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${label}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "vsf-switch inline-flex cursor-pointer border-none bg-transparent p-0",
          checked && "vsf-switch--on",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="vsf-switch__track">
          <span className="vsf-switch__thumb" />
        </span>
      </button>
    </div>
  );
}
