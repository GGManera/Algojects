"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { StyledTextarea, StyledTextareaProps } from '@/components/ui/StyledTextarea';

interface InteractionCardInputProps extends StyledTextareaProps {
  type: 'review' | 'comment' | 'reply' | 'notes' | 'project-description'; // Added 'project-description' for ProjectDetailsForm
  className?: string;
}

export function InteractionCardInput({ type, className, ...props }: InteractionCardInputProps) {
  let gradientClasses = "";
  let shadowClasses = "";
  let paddingClasses = "p-2"; // Default padding for the card wrapper
  let innerTextareaClasses = ""; // Classes for the StyledTextarea itself
  let textColorClass = "text-white"; // Default text color for dark gradients

  switch (type) {
    case 'review':
      gradientClasses = "from-gradient-start to-gradient-end";
      shadowClasses = "shadow-deep-lg";
      paddingClasses = "p-4"; // More padding for reviews
      innerTextareaClasses = "p-0"; // Textarea itself won't have padding, the card wrapper will
      break;
    case 'comment':
      gradientClasses = "from-comment-gradient-start/80 to-comment-gradient-end/80";
      shadowClasses = "shadow-deep-md";
      paddingClasses = "p-3"; // Medium padding for comments
      innerTextareaClasses = "p-0";
      break;
    case 'reply':
      gradientClasses = "from-notes-gradient-start/90 to-notes-gradient-end/90";
      shadowClasses = "shadow-deep-sm";
      paddingClasses = "p-2"; // Less padding for replies
      innerTextareaClasses = "p-0";
      textColorClass = "text-black"; // Set text color to black for light background
      break;
    case 'notes': // For NewProjectForm's projectNotes
    case 'project-description': // For ProjectDetailsForm's projectDescriptionContent
      gradientClasses = "from-notes-gradient-start to-notes-gradient-end";
      shadowClasses = "shadow-recessed"; // Changed to recessed shadow
      paddingClasses = "p-4"; // More padding for main notes
      innerTextareaClasses = "p-0"; // Textarea itself won't have padding, the card wrapper will
      textColorClass = "text-black"; // Set text color to black for light background
      break;
    default:
      gradientClasses = "from-gradient-start to-gradient-end";
      shadowClasses = "shadow-deep-lg";
      paddingClasses = "p-4";
      innerTextareaClasses = "p-0";
  }

  return (
    <div className={cn(
      "w-full bg-gradient-to-r rounded-lg overflow-hidden",
      gradientClasses,
      shadowClasses,
      paddingClasses, // Apply padding to the wrapper
      textColorClass, // Apply text color to the wrapper
      className
    )}>
      <StyledTextarea
        {...props}
        className={cn(
          "bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-y min-h-[80px]",
          // Ensure text color is applied to the textarea itself, and set placeholder color
          textColorClass,
          textColorClass === 'text-black' ? 'placeholder:text-black/70' : 'placeholder:text-white/70',
          innerTextareaClasses,
          props.className // Ensure any custom classes passed to StyledTextarea are still applied
        )}
      />
    </div>
  );
}