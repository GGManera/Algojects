"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ClickableSummaryCardProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  value: string;
  onClick: (id: string) => void;
  isActive: boolean;
}

export function ClickableSummaryCard({ id, icon, title, value, onClick, isActive }: ClickableSummaryCardProps) {
  return (
    <motion.div
      onClick={() => onClick(id)}
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-colors",
        "hover:bg-muted/70",
        isActive ? "bg-primary/20 border border-primary" : "bg-muted/50"
      )}
      initial={false} // Disable initial animation for layout
      animate={{
        scale: isActive ? 1.02 : 1,
        boxShadow: isActive ? "0 0 10px rgba(var(--primary), 0.3)" : "none",
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {icon}
      <span className="text-lg font-bold font-numeric text-foreground mt-1">{value}</span>
      <span className="text-xs text-muted-foreground">{title}</span>
    </motion.div>
  );
}