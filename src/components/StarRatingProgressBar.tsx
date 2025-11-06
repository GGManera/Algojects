"use client";

import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProgressBarProps {
  average: number;
  scale: number;
  totalResponses: number;
}

export function StarRatingProgressBar({ average, scale, totalResponses }: StarRatingProgressBarProps) {
  // Calculate the percentage of the average relative to the scale
  const fillPercentage = useMemo(() => {
    if (scale === 0) return 0;
    return (average / scale) * 100;
  }, [average, scale]);

  // Calculate the number of full stars and the fractional part
  const fullStars = Math.floor(average);
  const fractionalPart = average - fullStars;

  return (
    <div className="flex flex-col space-y-2 w-full max-w-[200px]"> {/* Added max-width for better centering control */}
      <div className="relative flex items-center h-6" title={`Average: ${average.toFixed(1)} / ${scale}`}>
        
        {/* 1. Background stars (unfilled) - Base layer */}
        <div className="flex absolute inset-0 items-center space-x-1">
          {Array.from({ length: scale }, (_, index) => (
            <Star
              key={`bg-${index}`}
              className="h-6 w-6 text-muted-foreground/50"
            />
          ))}
        </div>

        {/* 2. Foreground stars (Clipped container) - This container controls the overall fill width */}
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${fillPercentage}%` }}
        >
          {/* 3. Inner container with the actual filled stars and spacing, matching the background exactly */}
          <div className="flex items-center space-x-1"> 
            {Array.from({ length: scale }, (_, index) => {
              const isPartial = index === fullStars && fractionalPart > 0;

              return (
                <div key={`fg-${index}`} className="relative h-6 w-6 flex-shrink-0">
                  <Star
                    className={cn(
                      "h-6 w-6 text-yellow-400 fill-yellow-400"
                    )}
                  />
                  {/* Handle fractional fill for the partial star by overlaying a clipped gray star */}
                  {isPartial && (
                    <div 
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${(1 - fractionalPart) * 100}%`, left: `${fractionalPart * 100}%` }}
                    >
                      {/* Overlay the gray star exactly over the yellow star */}
                      <Star className="h-6 w-6 text-muted-foreground/50 fill-muted-foreground/50" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">Based on {totalResponses} responses.</p>
    </div>
  );
}