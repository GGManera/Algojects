"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import StyledSwitch from './StyledSwitch'; // Import the new styled switch

interface TagFilterModeToggleProps {
  mode: 'combined' | 'any';
  onModeChange: (mode: 'combined' | 'any') => void;
  disabled?: boolean;
}

export function TagFilterModeToggle({ mode, onModeChange, disabled = false }: TagFilterModeToggleProps) {
  const isCombined = mode === 'combined';
  const activeLabel = isCombined ? 'Combined' : 'Any';

  // 'Combined' mode corresponds to checked=true
  const handleToggle = (checked: boolean) => {
    onModeChange(checked ? 'combined' : 'any');
  };

  return (
    <div className={cn("flex items-center space-x-3", disabled && "opacity-50 pointer-events-none")}>
      <StyledSwitch
        checked={isCombined}
        onChange={handleToggle}
        disabled={disabled}
      />
      {/* Added fixed width (w-20) to prevent layout shift when text changes */}
      <span className="text-sm font-medium text-foreground w-20">
        {activeLabel}
      </span>
    </div>
  );
}