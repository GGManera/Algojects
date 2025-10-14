"use client";

import React from 'react'; // Removed useState, useEffect
import { cn } from '@/lib/utils';
import { Smartphone, Tablet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import the context hook

interface ReviewPreviewProps {
  content: string;
  type: 'review' | 'comment' | 'reply' | 'notes' | 'project-description';
  className?: string;
}

export function ReviewPreview({ content, type, className }: ReviewPreviewProps) {
  const { appDisplayMode } = useAppContextDisplayMode(); // Use global appDisplayMode

  const baseContentClasses = "whitespace-pre-wrap font-sans overflow-wrap-anywhere";

  let portraitContentClasses = "";
  let landscapeContentClasses = "";
  let gradientClasses = "";
  let textColorClass = "text-white"; // Default text color for gradients
  let fontWeightClass = ""; // New variable for font weight

  switch (type) {
    case 'review':
      portraitContentClasses = "text-base";
      landscapeContentClasses = "text-sm"; // Reduzido para landscape
      gradientClasses = "from-gradient-start to-gradient-end";
      fontWeightClass = "font-normal"; // Default for reviews
      break;
    case 'comment':
      portraitContentClasses = "text-sm";
      landscapeContentClasses = "text-xs"; // Reduzido para landscape
      gradientClasses = "from-comment-gradient-start to-comment-gradient-end";
      fontWeightClass = "font-normal"; // Default for comments
      break;
    case 'reply':
      portraitContentClasses = "text-xs";
      landscapeContentClasses = "text-[0.6rem]"; // Ainda menor para landscape
      gradientClasses = "from-notes-gradient-start to-notes-gradient-end";
      textColorClass = "text-white";
      fontWeightClass = "font-semibold"; // Bolder for replies
      break;
    case 'notes':
    case 'project-description': // Added for project description preview
      portraitContentClasses = "text-sm"; // Definido um tamanho para notes em portrait
      landscapeContentClasses = "text-xs"; // Definido um tamanho para notes em landscape
      gradientClasses = "from-notes-gradient-start to-notes-gradient-end";
      textColorClass = "text-white";
      fontWeightClass = "font-semibold"; // Bolder for notes
      break;
    default:
      portraitContentClasses = "text-sm";
      landscapeContentClasses = "text-sm";
      gradientClasses = "from-gradient-start to-gradient-end";
      fontWeightClass = "font-normal";
  }

  return (
    <div className={cn("mt-6 space-y-4", className)}>
      <h4 className="text-lg font-semibold text-center gradient-text">Content Preview</h4>
      {/* Removed the buttons for switching view modes, as it's now controlled globally */}

      <div className="flex justify-center">
        {appDisplayMode === 'portrait' && (
          <div className="w-full max-w-[360px] flex-none flex flex-col items-center p-2 bg-card rounded-lg shadow-deep-md">
            <p className="text-xs text-muted-foreground mb-2">Mobile Portrait (max 360px)</p>
            <div className={cn("w-full border border-border rounded-md p-2 overflow-hidden bg-gradient-to-r", gradientClasses, textColorClass)}>
              <p className={cn(baseContentClasses, portraitContentClasses, fontWeightClass, "selectable-text")}>
                {content || "Your content will appear here..."}
              </p>
            </div>
          </div>
        )}

        {appDisplayMode === 'landscape' && (
          <div className="w-full max-w-[640px] flex-none flex flex-col items-center p-1 bg-card rounded-lg shadow-deep-md">
            <p className="text-xs text-muted-foreground mb-1">Mobile Landscape (max 640px)</p>
            <div className={cn("w-full border border-border rounded-md p-1 overflow-hidden bg-gradient-to-r", gradientClasses, textColorClass)}>
              <p className={cn(baseContentClasses, landscapeContentClasses, fontWeightClass, "selectable-text")}>
                {content || "Your content will appear here..."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}