"use client";

import React, { useState, createContext, useContext, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface GlassRadioGroupContextType {
  selectedValue: string;
  onValueChange: (value: string) => void;
}

const GlassRadioGroupContext = createContext<GlassRadioGroupContextType | undefined>(undefined);

interface GlassRadioGroupProps {
  defaultValue: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function GlassRadioGroup({ defaultValue, onValueChange, children, className }: GlassRadioGroupProps) {
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
          "glass-radio-group", // Usar a classe CSS definida em globals.css
          className
        )}
      >
        {children}
        <div className="glass-glider"></div> {/* O glider é o último filho */}
      </div>
    </GlassRadioGroupContext.Provider>
  );
}

interface GlassRadioItemProps {
  value: string;
  label: string;
  id: string; // Used for the input id and label htmlFor
}

export function GlassRadioItem({ value, label, id }: GlassRadioItemProps) {
  const context = useContext(GlassRadioGroupContext);

  if (!context) {
    throw new Error("GlassRadioItem must be used within a GlassRadioGroup");
  }

  const { selectedValue, onValueChange } = context;
  const isChecked = selectedValue === value;

  return (
    <>
      <input
        type="radio"
        id={id}
        name="glass-radio-group"
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