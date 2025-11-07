"use client";

import React, { useMemo } from 'react';
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
  
  const gridClasses = useMemo(() => {
    const count = options.length;
    
    // Default for mobile is always 1 column
    let classes = "grid-cols-1 ";

    if (count === 2 || count === 4) {
      // 2 or 4 cards -> 2 columns on desktop (sm+)
      classes += "sm:grid-cols-2 sm:max-w-md mx-auto";
    } else if (count === 3 || count === 5 || count === 6) {
      // 3, 5, or 6 cards -> 3 columns on desktop (sm+)
      classes += "sm:grid-cols-3 sm:max-w-lg mx-auto";
    } else {
      // Default fallback for > 6 or other counts: 2 columns
      classes += "sm:grid-cols-2 sm:max-w-md mx-auto";
    }
    
    return classes;
  }, [options.length]);

  return (
    <div ref={ref} className={cn(`grid gap-3 p-2 rounded-md border transition-colors duration-200`, gridClasses, className)}>
      {options.map((option) => {
        const isSelected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => !disabled && onChange(option.id)} // Return the ID
            disabled={disabled}
            className={cn(
              "flex items-center justify-center p-3 rounded-lg border transition-all duration-200 text-center",
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