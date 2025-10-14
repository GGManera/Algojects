"use client";

import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface HistoryEntry {
  path: string;
  label: string;
  activeCategory?: 'writing' | 'curating'; // NEW
}

interface NavigationHistoryState {
  historyStack: HistoryEntry[];
  lastProjectPath: HistoryEntry | null;
  lastProfilePath: HistoryEntry | null;
  profile1: { address: string; label: string } | null;
  profile2: { address: string; label: string } | null;
  currentProfileSlot: 1 | 2 | null; // Which slot the *currently displayed* profile is in
  lastVisitedPage: HistoryEntry | null;
  lastVisitedPageIsProfile: boolean;
}

interface NavigationHistoryContextType extends NavigationHistoryState {
  pushEntry: (entry: HistoryEntry) => void;
  popEntry: () => HistoryEntry | undefined;
  getCurrentEntry: () => HistoryEntry | undefined;
  peekPreviousEntry: () => HistoryEntry | undefined;
  clearHistory: () => void;
}

const NavigationHistoryContext = createContext<NavigationHistoryContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'algojects_navigation_history';
const MAX_HISTORY_SIZE = 5; // Keep history stack small to avoid excessive localStorage usage

const getStoredHistory = (): NavigationHistoryState => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure all loaded entries have valid path and label
      return {
        ...parsed,
        historyStack: (parsed.historyStack || []).map((entry: any) => ({
          path: entry.path || '/',
          label: entry.label || 'Unknown Page',
          activeCategory: entry.activeCategory || undefined, // NEW
        })),
        lastProjectPath: parsed.lastProjectPath ? { path: parsed.lastProjectPath.path || '/', label: parsed.lastProjectPath.label || 'Unknown Project' } : null,
        lastProfilePath: parsed.lastProfilePath ? { path: parsed.lastProfilePath.path || '/', label: parsed.lastProfilePath.label || 'Unknown Profile', activeCategory: parsed.lastProfilePath.activeCategory || undefined } : null, // NEW: activeCategory for lastProfilePath
        profile1: parsed.profile1 ? { address: parsed.profile1.address || '', label: parsed.profile1.label || 'Profile 1' } : null,
        profile2: parsed.profile2 ? { address: parsed.profile2.address || '', label: parsed.profile2.label || 'Profile 2' } : null,
        currentProfileSlot: parsed.currentProfileSlot || null,
        lastVisitedPage: parsed.lastVisitedPage ? { path: parsed.lastVisitedPage.path || '/', label: parsed.lastVisitedPage.label || 'Unknown Page', activeCategory: parsed.lastVisitedPage.activeCategory || undefined } : null, // NEW: activeCategory for lastVisitedPage
        lastVisitedPageIsProfile: parsed.lastVisitedPageIsProfile ?? false,
      };
    }
  } catch (error) {
    console.error("Failed to load navigation history from localStorage:", error);
  }
  return {
    historyStack: [],
    lastProjectPath: null,
    lastProfilePath: null,
    profile1: null,
    profile2: null,
    currentProfileSlot: null,
    lastVisitedPage: null,
    lastVisitedPageIsProfile: false,
  };
};

export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const [historyState, setHistoryState] = useState<NavigationHistoryState>(getStoredHistory);
  const location = useLocation();

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(historyState));
    } catch (error) {
      console.error("Failed to save navigation history to localStorage:", error);
    }
  }, [historyState]);

  const pushEntry = useCallback((entry: HistoryEntry) => {
    setHistoryState(prevState => {
      const newHistoryStack = [...prevState.historyStack];
      let newLastProjectPath = prevState.lastProjectPath;
      let newLastProfilePath = prevState.lastProfilePath;
      let newProfile1 = prevState.profile1;
      let newProfile2 = prevState.profile2;
      let newCurrentProfileSlot = prevState.currentProfileSlot;
      let newLastVisitedPage = entry;
      let newLastVisitedPageIsProfile = entry.path.startsWith('/profile/');

      // 1. Update general history stack
      // If the last entry has the same path, update its label and activeCategory instead of adding a new entry
      if (newHistoryStack.length > 0 && newHistoryStack[newHistoryStack.length - 1].path === entry.path) {
        const lastEntry = newHistoryStack[newHistoryStack.length - 1];
        if (lastEntry.label !== entry.label || lastEntry.activeCategory !== entry.activeCategory) {
          newHistoryStack[newHistoryStack.length - 1] = entry;
        }
      } else {
        newHistoryStack.push(entry);
        // Limit history size
        if (newHistoryStack.length > MAX_HISTORY_SIZE) {
          newHistoryStack.shift();
        }
      }

      // 2. Update lastProjectPath
      if (entry.path.startsWith('/project/')) {
        newLastProjectPath = entry;
      }

      // 3. Update lastProfilePath and profile slots
      if (entry.path.startsWith('/profile/')) {
        newLastProfilePath = entry; // Store the full entry including activeCategory
        const newProfileAddress = entry.path.split('/')[2];
        const newProfileLabel = entry.label;
        // No need to store newProfileCategory in profile1/profile2, they are just for address/label switching

        // Check if the new profile is already in a slot
        if (newProfile1?.address === newProfileAddress) {
          newCurrentProfileSlot = 1;
          newProfile1 = { address: newProfileAddress, label: newProfileLabel }; // Update label if changed
        } else if (newProfile2?.address === newProfileAddress) {
          newCurrentProfileSlot = 2;
          newProfile2 = { address: newProfileAddress, label: newProfileLabel }; // Update label if changed
        } else { // It's a new profile address
          if (prevState.currentProfileSlot === 1) { // Was on profile1, now visiting new -> replace profile2
            newProfile2 = { address: newProfileAddress, label: newProfileLabel };
            newCurrentProfileSlot = 2;
          } else if (prevState.currentProfileSlot === 2) { // Was on profile2, now visiting new -> replace profile1
            newProfile1 = { address: newProfileAddress, label: newProfileLabel };
            newCurrentProfileSlot = 1;
          } else { // Came from non-profile page, or no current slot set
            if (!newProfile1) { // If profile1 is empty, fill it
              newProfile1 = { address: newProfileAddress, label: newProfileLabel };
              newCurrentProfileSlot = 1;
            } else if (!newProfile2) { // If profile2 is empty, fill it
              newProfile2 = { address: newProfileAddress, label: newProfileLabel };
              newCurrentProfileSlot = 2;
            } else { // Both full, came from non-profile, replace profile1 (arbitrary choice)
              newProfile1 = { address: newProfileAddress, label: newProfileLabel };
              newCurrentProfileSlot = 1;
            }
          }
        }
      } else { // Not a profile page, so no current profile slot
        newCurrentProfileSlot = null;
      }

      return {
        historyStack: newHistoryStack,
        lastProjectPath: newLastProjectPath,
        lastProfilePath: newLastProfilePath,
        profile1: newProfile1,
        profile2: newProfile2,
        currentProfileSlot: newCurrentProfileSlot,
        lastVisitedPage: newLastVisitedPage,
        lastVisitedPageIsProfile: newLastVisitedPageIsProfile,
      };
    });
  }, []);

  const popEntry = useCallback(() => {
    let poppedEntry: HistoryEntry | undefined;
    setHistoryState(prevState => {
      if (prevState.historyStack.length === 0) return prevState;
      const newStack = [...prevState.historyStack];
      poppedEntry = newStack.pop();
      return { ...prevState, historyStack: newStack };
    });
    return poppedEntry;
  }, []);

  const getCurrentEntry = useCallback(() => {
    return historyState.historyStack.length > 0 ? historyState.historyStack[historyState.historyStack.length - 1] : undefined;
  }, [historyState.historyStack]);

  const peekPreviousEntry = useCallback(() => {
    return historyState.historyStack.length > 1 ? historyState.historyStack[historyState.historyStack.length - 2] : undefined;
  }, [historyState.historyStack]);

  const clearHistory = useCallback(() => {
    setHistoryState({
      historyStack: [],
      lastProjectPath: null,
      lastProfilePath: null,
      profile1: null,
      profile2: null,
      currentProfileSlot: null,
      lastVisitedPage: null,
      lastVisitedPageIsProfile: false,
    });
  }, []);

  const contextValue = useMemo(() => ({
    ...historyState,
    pushEntry,
    popEntry,
    getCurrentEntry,
    peekPreviousEntry,
    clearHistory,
  }), [historyState, pushEntry, popEntry, getCurrentEntry, peekPreviousEntry, clearHistory]);

  return (
    <NavigationHistoryContext.Provider value={contextValue}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}

export function useNavigationHistory() {
  const context = useContext(NavigationHistoryContext);
  if (context === undefined) {
    throw new Error('useNavigationHistory must be used within an NavigationHistoryProvider');
  }
  return context;
}