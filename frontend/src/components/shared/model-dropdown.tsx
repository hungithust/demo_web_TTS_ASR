import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ModelOption } from "@/types/demo";

export interface ModelDropdownProps {
  id?: string;
  label?: string;
  options: ModelOption[];
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function ModelDropdown({
  id,
  label,
  options,
  placeholder = "Select a model",
  value,
  onValueChange,
  disabled = false,
  className,
  triggerClassName,
}: ModelDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const labelId = useId();

  const selectedOption = useMemo(() => {
    return options.find((option) => option.value === value);
  }, [options, value]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("space-y-2 overflow-visible", className)}>
      {label ? (
        <label id={labelId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}

      <div className="relative overflow-visible">
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={label ? labelId : undefined}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((current) => !current);
          }}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 text-left text-sm text-foreground shadow-sm outline-none transition",
            "focus:border-ring focus:ring-2 focus:ring-ring/20",
            disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted/40",
            triggerClassName,
          )}
        >
          <span className={cn("truncate", !selectedOption ? "text-muted-foreground" : "")}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "")} />
        </button>

        {open && !disabled ? (
          <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[9999] w-full">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <div className="p-1">
                {options.length > 0 ? (
                  options.map((option) => {
                    const active = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => handleSelect(option.value)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                          active ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-muted",
                        )}
                      >
                        <span className="truncate">{option.label}</span>
                        {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No models</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
