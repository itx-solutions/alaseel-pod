import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatsCard({
  title,
  value,
  description,
  className,
  icon,
}: {
  title: string;
  value: number | string;
  description?: string;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className={cn("border-gray-200 shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
          {icon ? <span className="text-gray-500 [&>svg]:size-5">{icon}</span> : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums text-gray-900">{value}</p>
        {description ? (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
