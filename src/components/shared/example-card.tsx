import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { cn } from "@/lib/utils";
import type { DemoItem } from "@/types/demo";

export interface ExampleCardProps {
  title: string;
  description: string;
  items: DemoItem[];
  icon?: ReactNode;
  className?: string;
}

export function ExampleCard({ title, description, items, icon, className }: ExampleCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="flex size-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            {icon ?? <CheckCircle2 className="size-4" />}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-muted/35 p-4">
              <p className="font-medium tracking-tight">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
              <p className="mt-3 text-sm leading-6 text-foreground/90">{item.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
