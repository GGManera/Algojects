"use client";

import React, { createContext, useState, useContext, useMemo, useCallback } from 'react';

interface HeroLogoVisibilityContextType {
  isHeroLogoVisible: boolean;
  setHeroLogoVisibility: (isVisible: boolean) => void;
}

const HeroLogoVisibilityContext = createContext<HeroLogoVisibilityContextType | undefined>(undefined);

export function HeroLogoVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isHeroLogoVisible, setIsHeroLogoVisible] = useState(true); // Default to visible

  const setHeroLogoVisibility = useCallback((isVisible: boolean) => {
    setIsHeroLogoVisible(isVisible);
  }, []);

  const contextValue = useMemo(() => ({
    isHeroLogoVisible,
    setHeroLogoVisibility,
  }), [isHeroLogoVisible, setHeroLogoVisibility]);

  return (
    <HeroLogoVisibilityContext.Provider value={contextValue}>
      {children}
    </HeroLogoVisibilityContext.Provider>
  );
}

export function useHeroLogoVisibility() {
  const context = useContext(HeroLogoVisibilityContext);
  if (context === undefined) {
    throw new Error('useHeroLogoVisibility must be used within a HeroLogoVisibilityProvider');
  }
  return context;
}