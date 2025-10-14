"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleContentProps {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * A simple collapsible component using CSS transitions on max-height to replace 
 * complex framer-motion height animations for better performance.
 * 
 * Note: The max-h-[2000px] must be large enough to contain the content when open.
 */
export function CollapsibleContent({ isOpen, children, className }: CollapsibleContentProps) {
  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        // Use a large max-height when open, and max-h-0 when closed.
        isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}