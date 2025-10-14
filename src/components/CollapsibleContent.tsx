"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleContentProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * A collapsible component that animates using the CSS grid `grid-template-rows` property.
 * This provides a more robust alternative to the `max-height` trick, especially for content
 * with margins that can cause layout jumps or residual space.
 */
export function CollapsibleContent({ isOpen, children, className }: CollapsibleContentProps) {
  return (
    <div
      className={cn(
        "grid transition-all duration-300 ease-in-out",
        // Animate the grid row height. 0fr collapses it, 1fr expands to content size.
        // Apply margin top only when the component is open to prevent layout shifts from collapsed siblings.
        isOpen ? "grid-rows-[1fr] mt-4" : "grid-rows-[0fr] mt-0"
      )}
    >
      <div 
        className={cn(
          "overflow-hidden transition-opacity duration-300 ease-in-out",
          // Animate opacity for a smooth fade in/out effect.
          isOpen ? "opacity-100" : "opacity-0",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}