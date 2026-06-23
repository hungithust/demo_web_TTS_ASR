import { useEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autoResize?: boolean;
};

export function Textarea({ className, autoResize = false, value, onChange, ...props }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!autoResize || !ref.current) return;
    ref.current.style.height = "auto";
    const maxHeight = 220;
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, maxHeight)}px`;
    ref.current.style.overflowY = ref.current.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [autoResize, value]);

  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[44px] w-full resize-none rounded-md border border-border bg-card px-4 py-2 text-sm leading-6 text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground",
        "focus:border-ring focus:ring-2 focus:ring-ring/20",
        className,
      )}
      value={value}
      onChange={onChange}
      {...props}
    />
  );
}
