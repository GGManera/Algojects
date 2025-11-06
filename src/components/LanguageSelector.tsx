"use client";

import React from 'react';
import { GlassRadioGroupTwoItems, GlassRadioItemTwoItems } from './GlassRadioGroupTwoItems';
import { useFeedbackLanguage, FeedbackLanguage } from '@/contexts/FeedbackLanguageContext';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  disabled?: boolean;
  className?: string;
}

export function LanguageSelector({ disabled = false, className }: LanguageSelectorProps) {
  const { language, setLanguage } = useFeedbackLanguage();

  const handleValueChange = (value: string) => {
    setLanguage(value as FeedbackLanguage);
  };

  return (
    <div className={cn("w-full max-w-xs mx-auto", className)}>
      <GlassRadioGroupTwoItems
        defaultValue={language}
        onValueChange={handleValueChange}
        className={cn(disabled && "opacity-50 pointer-events-none")}
        groupName="feedback-language-selector" // Unique group name
      >
        <GlassRadioItemTwoItems
          value="en"
          id="lang-en" // Unique ID for CSS targeting
          label={
            <span className="flex items-center justify-center gap-2 text-xs"> {/* Reduced font size here */}
              <img src="/flag-us.png" alt="US Flag" className="h-5 w-5 rounded-full object-cover" /> {/* Added object-cover */}
              English-US
            </span>
          }
        />
        <GlassRadioItemTwoItems
          value="pt"
          id="lang-pt" // Unique ID for CSS targeting
          label={
            <span className="flex items-center justify-center gap-2 text-xs"> {/* Reduced font size here */}
              <img src="/flag-br.png" alt="BR Flag" className="h-5 w-5 rounded-full object-cover" /> {/* Added object-cover */}
              Português-BR
            </span>
          }
        />
      </GlassRadioGroupTwoItems>
    </div>
  );
}