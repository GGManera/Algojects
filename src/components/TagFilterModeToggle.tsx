"use client";

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface TagFilterModeToggleProps {
  mode: 'combined' | 'any';
  onModeChange: (mode: 'combined' | 'any') => void;
  disabled?: boolean;
}

export function TagFilterModeToggle({ mode, onModeChange, disabled = false }: TagFilterModeToggleProps) {
  const isCombined = mode === 'combined';

  const handleToggle = (checked: boolean) => {
    onModeChange(checked ? 'combined' : 'any');
  };

  return (
    <div className={cn("flex items-center space-x-2", disabled && "opacity-50 pointer-events-none")}>
      <Label htmlFor="tag-filter-mode" className="text-sm font-medium text-muted-foreground w-16 text-right">
        Any
      </Label>
      <Switch
        id="tag-filter-mode"
        checked={isCombined}
        onCheckedChange={handleToggle}
        disabled={disabled}
        // Custom styling for the switch track/thumb if needed, but using default shadcn/ui for now
      />
      <Label htmlFor="tag-filter-mode" className="text-sm font-medium text-foreground w-16">
        Combined
      </Label>
    </div>
  );
}