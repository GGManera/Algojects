"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';

interface Option {
  id: string;
  label: string;
}

interface SingleChoiceCardGroupProps {
  options: Option[]; // Updated type to Option[]
  value: string | null; // Value is now the Option ID
  onChange: (newValue: string) => void;
  disabled?: boolean;
  className?: string;
}

export const SingleChoiceCardGroup = React.forwardRef<HTMLDivElement, SingleChoiceCardGroupProps>(({ options, value, onChange, disabled = false, className }, ref) => {
  return (
    <div ref={ref} className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3 p-2 rounded-md border transition-colors duration-200", className)}>
      {options.map((option) => {
        const isSelected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => !disabled && onChange(option.id)} // Return the ID
            disabled={disabled}
            className={cn(
              "flex items-center justify-center p-3 rounded-lg border transition-all duration-200 text-center", // Added justify-center and text-center
              "text-sm font-medium text-foreground",
              disabled ? "bg-muted/30 border-muted-foreground/20 cursor-not-allowed" : "bg-muted/50 border-muted hover:bg-muted/70 cursor-pointer",
              isSelected ? "border-primary bg-primary/20 shadow-md" : ""
            )}
          >
            <span className="flex items-center justify-center w-full"> {/* Wrapper to ensure content is centered */}
              <span>{option.label}</span> {/* Display the Label */}
              {isSelected && <CheckCircle className="h-4 w-4 text-primary ml-2 flex-shrink-0" />}
            </span>
          </button>
        );
      })}
    </div>
  );
});

SingleChoiceCardGroup.displayName = "SingleChoiceCardGroup";