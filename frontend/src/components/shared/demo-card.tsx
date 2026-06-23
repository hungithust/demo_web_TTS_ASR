import type { PropsWithChildren, ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/shared/card";
import { cn } from "@/lib/utils";

export interface DemoCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  className?: string;
}

export function DemoCard({
  title,
  icon,
  className,
  children,
}: DemoCardProps) {
  return (
    <Card className={cn("overflow-visible", className)}>
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon ?? <Sparkles className="size-4" />}
        </div>
        <h3 className="font-display text-2xl font-bold tracking-tight">{title}</h3>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
