"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DynamicNavButtonsProps {
  leftButton?: {
    onClick: () => void;
    label?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
  };
  rightButton?: {
    onClick: () => void;
    label?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
  };
}

const DynamicNavButtons: React.FC<DynamicNavButtonsProps> = ({
  leftButton,
  rightButton,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="relative w-full max-w-3xl mx-auto flex justify-between items-center px-2 h-16">
        {leftButton ? (
          <Button 
            variant="ghost" 
            onClick={leftButton.onClick} 
            disabled={leftButton.disabled}
            className="flex items-center"
          >
            {leftButton.icon || <ChevronLeft className="h-4 w-4 mr-1" />}
            {leftButton.label}
          </Button>
        ) : (
          <div className="w-16"></div> // Placeholder to maintain spacing if only one button
        )}

        {rightButton ? (
          <Button 
            variant="ghost" 
            onClick={rightButton.onClick} 
            disabled={rightButton.disabled}
            className="flex items-center"
          >
            {rightButton.label}
            {rightButton.icon || <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        ) : (
          <div className="w-16"></div> // Placeholder to maintain spacing if only one button
        )}
      </div>
    </div>
  );
};

export default DynamicNavButtons;