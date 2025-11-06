"use client";

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingInputProps {
  scale: number; // Max rating value
  value: number | null; // Current selected rating
  onChange: (newValue: number | null) => void;
  disabled?: boolean;
  className?: string; // NEW: Add className prop
}

export const RatingInput = React.forwardRef<HTMLDivElement, RatingInputProps>(({ scale, value, onChange, disabled = false, className }, ref) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;

  const handleClick = (index: number) => {
    if (disabled) return;
    const newValue = index + 1;
    // If the clicked value is the same as the current value, deselect (set to null)
    if (newValue === value) {
      onChange(null);
    } else {
      onChange(newValue);
    }
  };

  const handleMouseEnter = (index: number) => {
    if (disabled) return;
    setHoverValue(index + 1);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    setHoverValue(null);
  };

  return (
    <div ref={ref} className={cn("flex items-center space-x-1 p-2 rounded-md border transition-colors duration-200", className)}>
      {Array.from({ length: scale }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "h-6 w-6 cursor-pointer transition-colors duration-150",
            disabled ? "text-muted-foreground/50" : "text-muted-foreground",
            (index < displayValue) && (disabled ? "fill-muted-foreground/50" : "fill-yellow-400 text-yellow-400"),
            !disabled && "hover:text-yellow-400 hover:fill-yellow-400"
          )}
          onClick={() => handleClick(index)}
          onMouseEnter={() => handleMouseEnter(index)}
          onMouseLeave={handleMouseLeave}
          aria-label={`Rate ${index + 1} out of ${scale}`}
        />
      ))}
    </div>
  );
});

RatingInput.displayName = "RatingInput";