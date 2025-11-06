"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';

interface SingleChoiceCardGroupProps {
  options: string[];
  value: string | null;
  onChange: (newValue: string) => void;
  disabled?: boolean;
  className?: string; // NEW: Add className prop
}

export const SingleChoiceCardGroup = React.forwardRef<HTMLDivElement, SingleChoiceCardGroupProps>(({ options, value, onChange, disabled = false, className }, ref) => {
  return (
    <div ref={ref} className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3 p-2 rounded-md border transition-colors duration-200", className)}>
      {options.map((option) => {
        const isSelected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => !disabled && onChange(option)}
            disabled={disabled}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-all duration-200",
              "text-sm font-medium text-foreground",
              disabled ? "bg-muted/30 border-muted-foreground/20 cursor-not-allowed" : "bg-muted/50 border-muted hover:bg-muted/70 cursor-pointer",
              isSelected ? "border-primary bg-primary/20 shadow-md" : ""
            )}
          >
            <span>{option}</span>
            {isSelected && <CheckCircle className="h-4 w-4 text-primary ml-2" />}
          </button>
        );
      })}
    </div>
  );
});

SingleChoiceCardGroup.displayName = "SingleChoiceCardGroup";