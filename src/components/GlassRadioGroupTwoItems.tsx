"use client";

import React, { useState, createContext, useContext, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface GlassRadioGroupContextType {
  selectedValue: string;
  onValueChange: (value: string) => void;
  groupName: string; // NEW: Pass group name down
}

const GlassRadioGroupContext = createContext<GlassRadioGroupContextType | undefined>(undefined);

interface GlassRadioGroupTwoItemsProps {
  defaultValue: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  groupName?: string; // NEW: Optional group name
}

export function GlassRadioGroupTwoItems({ defaultValue, onValueChange, children, className, groupName = "glass-radio-group-two-items" }: GlassRadioGroupTwoItemsProps) {
  const [selectedValue, setSelectedValue] = useState(defaultValue);

  const handleValueChange = (value: string) => {
    setSelectedValue(value);
    onValueChange(value);
  };

  const contextValue = useMemo(() => ({
    selectedValue,
    onValueChange: handleValueChange,
    groupName, // Pass groupName
  }), [selectedValue, groupName]);

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
  label: React.ReactNode; // Changed to React.ReactNode to support emojis/spans
  id: string; // Used for the input id and label htmlFor
}

export function GlassRadioItemTwoItems({ value, label, id }: GlassRadioItemProps) {
  const context = useContext(GlassRadioGroupContext);

  if (!context) {
    throw new Error("GlassRadioItemTwoItems must be used within a GlassRadioGroupTwoItems");
  }

  const { selectedValue, onValueChange, groupName } = context;
  const isChecked = selectedValue === value;

  return (
    <>
      <input
        type="radio"
        id={id}
        name={groupName} // Use the dynamic group name
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