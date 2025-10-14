"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ClickableSummaryCardProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  value: string;
  onClick: (id: string) => void;
  isActive: boolean;
}

export function ClickableSummaryCard({ id, icon, title, value, onClick, isActive }: ClickableSummaryCardProps) {
  return (
    <Card
      onClick={() => onClick(id)}
      className={cn(
        "cursor-pointer transition-all duration-300 ease-in-out",
        "flex flex-col items-center justify-center text-center p-4 h-full",
        isActive 
          ? "ring-2 ring-primary bg-primary/10 scale-105" 
          : "hover:bg-muted/50 hover:scale-105"
      )}
    >
      <div className="mb-2">{icon}</div>
      <h3 className="text-xs font-semibold text-muted-foreground leading-tight">{title}</h3>
      <p className="text-md font-bold font-numeric">{value}</p>
    </Card>
  );
}