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
    <div className="flex flex-col space-y-2">
      {/* Removed space-x-1 from the outermost relative container */}
      <div className="relative flex items-center h-6" title={`Average: ${average.toFixed(1)} / ${scale}`}>
        
        {/* Background stars (unfilled) */}
        <div className="flex absolute inset-0 items-center space-x-1">
          {Array.from({ length: scale }, (_, index) => (
            <Star
              key={`bg-${index}`}
              className="h-6 w-6 text-muted-foreground/50"
            />
          ))}
        </div>

        {/* Foreground stars (Clipped container) */}
        <div 
          className="absolute inset-0 overflow-hidden" // This container clips the content
          style={{ width: `${fillPercentage}%` }}
        >
          {/* Inner container with the actual stars and spacing, matching the background */}
          <div className="flex items-center space-x-1"> 
            {Array.from({ length: scale }, (_, index) => {
              const isFull = index < fullStars;
              const isPartial = index === fullStars && fractionalPart > 0;

              return (
                <div key={`fg-${index}`} className="relative h-6 w-6 flex-shrink-0">
                  <Star
                    className={cn(
                      "h-6 w-6 text-yellow-400",
                      isFull ? "fill-yellow-400" : ""
                    )}
                  />
                  {/* Handle fractional fill for the partial star */}
                  {isPartial && (
                    <div 
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${fractionalPart * 100}%` }}
                    >
                      <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Based on {totalResponses} responses.</p>
    </div>
  );
}