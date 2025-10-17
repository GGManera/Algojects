"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface NavigableItem {
  id: string;
  toggleExpand: () => void;
  isExpanded: boolean;
  type: 'review' | 'comment' | 'reply' | 'project-summary';
}

// Global map to hold all registered items, scoped by pageKey
const globalNavigableItemsMap = new Map<string, Map<string, NavigableItem>>();
// Global map to hold the ordered IDs for each pageKey
const globalOrderedIdsMap = new Map<string, string[]>();

const LAST_ACTIVE_ID_KEY = 'algojects_last_active_id';

// Function to update the ordered list of IDs based on DOM order for a specific pageKey
const updateOrderedIds = (pageKey: string) => {
  const container = document.getElementById(pageKey); 
  if (!container) return;

  // Find all elements that have the data attribute in DOM order
  const elements = Array.from(container.querySelectorAll('[data-nav-id]')) as HTMLElement[];
  
  const currentItemsMap = globalNavigableItemsMap.get(pageKey) || new Map();

  // Filter and map to IDs based on DOM order, ensuring they are registered
  const orderedIds = elements
    .map(el => el.getAttribute('data-nav-id'))
    .filter((id): id is string => id !== null && currentItemsMap.has(id));
    
  globalOrderedIdsMap.set(pageKey, orderedIds);
  return orderedIds;
};

export function useKeyboardNavigation(pageKey: string) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isMouseActive, setIsMouseActive] = useState(false);
  const [isKeyboardModeActive, setIsKeyboardModeActive] = useState(false); // NEW state
  const mouseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const pageKeyRef = useRef(pageKey);
  pageKeyRef.current = pageKey;

  // --- Cache Management ---
  const getCachedActiveId = useCallback(() => {
    try {
      const cached = localStorage.getItem(LAST_ACTIVE_ID_KEY);
      if (cached) {
        const { id, path } = JSON.parse(cached);
        // Only restore if the path matches the current path
        if (path === location.pathname) {
          return id;
        }
      }
    } catch (e) {
      console.error("Failed to read last active ID from cache:", e);
    }
    return null;
  }, [location.pathname]);

  const setCacheActiveId = useCallback((id: string | null) => {
    if (id) {
      try {
        localStorage.setItem(LAST_ACTIVE_ID_KEY, JSON.stringify({ id, path: location.pathname }));
      } catch (e) {
        console.error("Failed to write last active ID to cache:", e);
      }
    } else {
      localStorage.removeItem(LAST_ACTIVE_ID_KEY);
    }
  }, [location.pathname]);

  // --- Mouse Activity Detection ---
  useEffect(() => {
    const handleMouseMove = () => {
      if (!isMouseActive) {
        setIsMouseActive(true);
      }
      if (mouseTimeoutRef.current) {
        clearTimeout(mouseTimeoutRef.current);
      }
      // Keep mouse active for 500ms after last movement
      mouseTimeoutRef.current = setTimeout(() => {
        setIsMouseActive(false);
      }, 500);
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (mouseTimeoutRef.current) {
        clearTimeout(mouseTimeoutRef.current);
      }
    };
  }, [isMouseActive]);

  // --- Cursor Management Effect ---
  useEffect(() => {
    if (isKeyboardModeActive) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = 'default';
    }
    return () => {
      document.body.style.cursor = 'default';
    };
  }, [isKeyboardModeActive]);

  // --- Mouse Hover Tracking (External API) ---
  const setLastActiveId = useCallback((id: string | null) => {
    // 1. Always update the cache on hover/mouse leave.
    setCacheActiveId(id);

    // 2. If the mouse enters a valid item AND the keyboard currently has focus,
    // clear the keyboard focus (focusedId) to transfer control to the mouse.
    if (id !== null && focusedId !== null && id !== focusedId) {
        setFocusedId(null);
        setIsKeyboardModeActive(false); // Disable keyboard mode when mouse takes over
    }
  }, [setCacheActiveId, focusedId]);

  // --- Registration Management ---
  const registerItem = useCallback((id: string, toggleExpand: () => void, isExpanded: boolean, type: NavigableItem['type']) => {
    const currentKey = pageKeyRef.current;
    if (currentKey === 'inactive') return () => {};

    if (!globalNavigableItemsMap.has(currentKey)) {
      globalNavigableItemsMap.set(currentKey, new Map());
    }
    const itemsMap = globalNavigableItemsMap.get(currentKey)!;
    
    itemsMap.set(id, { id, toggleExpand, isExpanded, type });
    updateOrderedIds(currentKey);

    return () => {
      if (pageKeyRef.current === currentKey) {
        itemsMap.delete(id);
        updateOrderedIds(currentKey);
      }
    };
  }, []);

  // --- Explicit Rebuild Function ---
  const rebuildOrder = useCallback(() => {
    const currentKey = pageKeyRef.current;
    if (currentKey === 'inactive') return;
    
    const orderedIds = updateOrderedIds(currentKey);
    
    // If no item is currently focused, try to restore from cache
    if (focusedId === null && orderedIds.length > 0) {
        const cachedId = getCachedActiveId();
        if (cachedId && orderedIds.includes(cachedId)) {
            // Restore focus ID, but DO NOT scroll into view here.
            setFocusedId(cachedId);
        } else {
            // If cache is invalid or empty, set focus to the first item
            setFocusedId(orderedIds[0]);
        }
    }
    return orderedIds;
  }, [focusedId, getCachedActiveId]);

  // --- Effect to manage focus state and cleanup when pageKey changes ---
  useEffect(() => {
    const currentKey = pageKeyRef.current;
    
    if (currentKey === 'inactive') {
      setFocusedId(null);
      setIsKeyboardModeActive(false); // Ensure mode is off
      return;
    }

    // Reset focus when the pageKey changes (e.g., navigating from project/a to project/b)
    setFocusedId(null);
    setIsKeyboardModeActive(false); // Reset mode on page change
    
    return () => {
      if (currentKey !== 'inactive') {
        globalNavigableItemsMap.delete(currentKey);
        globalOrderedIdsMap.delete(currentKey);
      }
    };
  }, [pageKey]);


  // --- Keyboard Handler ---
  useEffect(() => {
    const currentKey = pageKeyRef.current;
    if (currentKey === 'inactive') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA';
      if (isInputFocused) return;

      const orderedIds = globalOrderedIdsMap.get(currentKey) || [];
      const itemsMap = globalNavigableItemsMap.get(currentKey) || new Map();

      const key = e.key.toLowerCase();
      const isMovementKey = ['arrowdown', 'arrowup', 's', 'w'].includes(key);
      const isActionKey = key === ' ';
      const isRightKey = ['arrowright', 'd'].includes(key);
      const isNavigationKey = isMovementKey || isActionKey || isRightKey;

      if (!isNavigationKey) return;

      // If mouse is active, ignore keyboard navigation
      if (isMouseActive) {
        // If a movement key is pressed while mouse is active, activate keyboard mode
        if (isMovementKey) {
            setIsKeyboardModeActive(true);
            // If focusedId is null, try to restore it now to start keyboard navigation
            if (focusedId === null && orderedIds.length > 0) {
                const cachedId = getCachedActiveId();
                if (cachedId && orderedIds.includes(cachedId)) {
                    setFocusedId(cachedId);
                } else {
                    setFocusedId(orderedIds[0]);
                }
            }
        } else {
            e.preventDefault();
            return;
        }
      }

      // If keyboard mode is not active, only movement keys can activate it
      if (!isKeyboardModeActive && isMovementKey) {
          setIsKeyboardModeActive(true);
      }

      if (!isKeyboardModeActive) return; // Only proceed if keyboard mode is active

      // --- Keyboard Mode Logic ---
      let currentFocus = focusedId;
      let shouldScroll = false; 

      if (currentFocus === null && orderedIds.length > 0) {
        // This block should only run if keyboard mode was just activated by a movement key
        const cachedId = getCachedActiveId();
        currentFocus = (cachedId && orderedIds.includes(cachedId)) ? cachedId : orderedIds[0];
        if (isMovementKey) {
            shouldScroll = true;
        }
        setFocusedId(currentFocus);
      } else if (currentFocus !== null && isMovementKey) {
        shouldScroll = true;
      }
      
      const currentIndex = currentFocus ? orderedIds.indexOf(currentFocus) : -1;
      let nextIndex = currentIndex;

      if (key === 'arrowdown' || key === 's') {
        e.preventDefault();
        nextIndex = Math.min(currentIndex + 1, orderedIds.length - 1);
      } else if (key === 'arrowup' || key === 'w') {
        e.preventDefault();
        nextIndex = Math.max(currentIndex - 1, 0);
      } else if (isActionKey) {
        if (currentFocus) {
          e.preventDefault();
          const item = itemsMap.get(currentFocus);
          if (item) {
            item.toggleExpand();
            itemsMap.set(currentFocus, { ...item, isExpanded: !item.isExpanded });
            updateOrderedIds(currentKey);
          }
        }
        return;
      } else if (isRightKey) {
        // Let the parent component handle right navigation (NewWebsite.tsx)
        return;
      } else {
        return;
      }

      if (orderedIds.length > 0) {
        const nextId = orderedIds[nextIndex];
        setFocusedId(nextId);
        
        if (shouldScroll) {
            const element = document.querySelector(`[data-nav-id="${nextId}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedId, pageKey, isMouseActive, isKeyboardModeActive, getCachedActiveId, setCacheActiveId]);

  // Reset focus when navigating to a new route (even if pageKey remains the same, e.g., project/a to project/b)
  useEffect(() => {
    setFocusedId(null);
    setIsKeyboardModeActive(false);
  }, [location.pathname]);

  return { focusedId, registerItem, rebuildOrder, setLastActiveId };
}