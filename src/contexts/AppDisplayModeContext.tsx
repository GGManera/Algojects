"use client";

import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

type AppDisplayMode = 'portrait' | 'landscape';

interface AppDisplayModeContextType {
  appDisplayMode: AppDisplayMode;
  isDeviceLandscape: boolean;
  isMobile: boolean;
}

const AppDisplayModeContext = createContext<AppDisplayModeContextType | undefined>(undefined);

export function AppDisplayModeProvider({ children }: { children: React.ReactNode }) {
  const [isDeviceLandscape, setIsDeviceLandscape] = useState(false);
  const isMobile = useIsMobile();

  // Detect actual device orientation
  useEffect(() => {
    const mediaQuery = window.matchMedia('(orientation: landscape)');
    const handleOrientationChange = (event: MediaQueryListEvent) => {
      setIsDeviceLandscape(event.matches);
    };

    setIsDeviceLandscape(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleOrientationChange);

    return () => {
      mediaQuery.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  // Derive appDisplayMode directly from the device's orientation
  const appDisplayMode: AppDisplayMode = isDeviceLandscape ? 'landscape' : 'portrait';

  const contextValue = useMemo(() => ({
    appDisplayMode,
    isDeviceLandscape,
    isMobile,
  }), [appDisplayMode, isDeviceLandscape, isMobile]);

  return (
    <AppDisplayModeContext.Provider value={contextValue}>
      {children}
    </AppDisplayModeContext.Provider>
  );
}

export function useAppContextDisplayMode() {
  const context = useContext(AppDisplayModeContext);
  if (context === undefined) {
    throw new Error('useAppContextDisplayMode must be used within an AppDisplayModeProvider');
  }
  return context;
}