"use client";

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { RatingInput } from './RatingInput';
import { SingleChoiceCardGroup } from './SingleChoiceCardGroup';

interface QuestionRendererProps {
  question: any;
  value: any;
  onChange: (value: any) => void;
  isInvalid: boolean;
}

// Placeholder component for rendering individual questions
export const QuestionRenderer = React.forwardRef<HTMLDivElement, QuestionRendererProps>(({ question, value, onChange, isInvalid }, ref) => {
  const labelText = question.question + (question.required ? ' *' : ' (Optional)');
  
  // Define classes for invalid state
  const invalidClasses = isInvalid ? "border-red-500 ring-2 ring-red-500" : "border-muted";

  switch (question.type) {
    case 'rating':
      return (
        <div className="space-y-2" id={question.id}>
          <Label htmlFor={`question-${question.id}`}>{labelText}</Label>
          <RatingInput
            ref={ref}
            id={`question-${question.id}`}
            scale={question.scale || 5}
            value={value}
            onChange={onChange}
            className={invalidClasses} // Apply invalid classes to the container
          />
        </div>
      );
    case 'text':
      return (
        <div className="space-y-2" id={question.id}>
          <Label htmlFor={`question-${question.id}`}>{labelText}</Label>
          <Textarea
            ref={ref as React.Ref<HTMLTextAreaElement>} // Cast ref for textarea
            id={`question-${question.id}`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn("bg-muted/50 min-h-[80px]", invalidClasses)} // Apply invalid classes directly
          />
        </div>
      );
    case 'single_choice':
      return (
        <div className="space-y-2" id={question.id}>
          <Label htmlFor={`question-${question.id}`}>{labelText}</Label>
          <SingleChoiceCardGroup
            ref={ref}
            id={`question-${question.id}`}
            options={question.options || []}
            value={value || null}
            onChange={onChange}
            className={invalidClasses} // Apply invalid classes to the container
          />
        </div>
      );
    default:
      return <p className="text-red-500">Unsupported question type: {question.type}</p>;
  }
});

QuestionRenderer.displayName = "QuestionRenderer";