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
      >
        <GlassRadioItemTwoItems
          value="en"
          id="lang-en"
          label={
            <span className="flex items-center justify-center gap-2">
              🇺🇸 English-US
            </span>
          }
        />
        <GlassRadioItemTwoItems
          value="pt"
          id="lang-pt"
          label={
            <span className="flex items-center justify-center gap-2">
              🇧🇷 Português-BR
            </span>
          }
        />
      </GlassRadioGroupTwoItems>
    </div>
  );
}