"use client";

import React, { createContext, useState, useContext, useMemo, useCallback } from 'react';

export type FeedbackLanguage = 'en' | 'pt';

interface FeedbackLanguageContextType {
  language: FeedbackLanguage;
  setLanguage: (lang: FeedbackLanguage) => void;
}

const FeedbackLanguageContext = createContext<FeedbackLanguageContextType | undefined>(undefined);

export function FeedbackLanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to English, or try to detect browser language if needed (keeping it simple for now)
  const [language, setLanguage] = useState<FeedbackLanguage>('en'); 

  const contextValue = useMemo(() => ({
    language,
    setLanguage,
  }), [language]);

  return (
    <FeedbackLanguageContext.Provider value={contextValue}>
      {children}
    </FeedbackLanguageContext.Provider>
  );
}

export function useFeedbackLanguage() {
  const context = useContext(FeedbackLanguageContext);
  if (context === undefined) {
    throw new Error('useFeedbackLanguage must be used within a FeedbackLanguageProvider');
  }
  return context;
}