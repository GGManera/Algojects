"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AppDisplayModeContextType {
  isMobile: boolean;
}

const AppDisplayModeContext = createContext<AppDisplayModeContextType>({ isMobile: false });

export const AppDisplayModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <AppDisplayModeContext.Provider value={{ isMobile }}>
      {children}
    </AppDisplayModeContext.Provider>
  );
};

export const useAppContextDisplayMode = () => useContext(AppDisplayModeContext);