"use client";

import React, { useState, createContext, useContext, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface GlassRadioGroupContextType {
  selectedValue: string;
  onValueChange: (value: string) => void;
}

const GlassRadioGroupContext = createContext<GlassRadioGroupContextType | undefined>(undefined);

interface GlassRadioGroupTwoItemsProps {
  defaultValue: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function GlassRadioGroupTwoItems({ defaultValue, onValueChange, children, className }: GlassRadioGroupTwoItemsProps) {
  const [selectedValue, setSelectedValue] = useState(defaultValue);

  const handleValueChange = (value: string) => {
    setSelectedValue(value);
    onValueChange(value);
  };

  const contextValue = useMemo(() => ({
    selectedValue,
    onValueChange: handleValueChange,
  }), [selectedValue]);

  return (
    <GlassRadioGroupContext.Provider value={contextValue}>
      <div
        className={cn(
          "glass-radio-group-two-items", // Use a new class for the container
          className
        )}
      >
        {children}
        <div className="glass-glider-two-items"></div> {/* Use a new class for the glider */}
      </div>
    </GlassRadioGroupContext.Provider>
  );
}

interface GlassRadioItemProps {
  value: string;
  label: string;
  id: string; // Used for the input id and label htmlFor
}

export function GlassRadioItemTwoItems({ value, label, id }: GlassRadioItemProps) {
  const context = useContext(GlassRadioGroupContext);

  if (!context) {
    throw new Error("GlassRadioItemTwoItems must be used within a GlassRadioGroupTwoItems");
  }

  const { selectedValue, onValueChange } = context;
  const isChecked = selectedValue === value;

  return (
    <>
      <input
        type="radio"
        id={id}
        name="glass-radio-group-two-items" // Unique name for this group
        value={value}
        checked={isChecked}
        onChange={() => onValueChange(value)}
        className="hidden"
      />
      <label
        htmlFor={id}
      >
        {label}
      </label>
    </>
  );
}