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
const BUFFER_DURATION_MS = 500;
const PROCESSING_INTERVAL_MS = 50;

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
  const [isKeyboardModeActive, setIsKeyboardModeActive] = useState(false);
  const mouseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const pageKeyRef = useRef(pageKey);
  pageKeyRef.current = pageKey;

  // NEW: Key buffer to store key presses and their timestamps
  const keyBufferRef = useRef<{ key: string, timestamp: number }[]>([]);
  const isProcessingRef = useRef(false); // To prevent re-entry into the processing loop

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

  // --- Core Key Processing Logic (Moved to a separate function) ---
  const processKey = useCallback((key: string, currentFocus: string | null) => {
    const currentKey = pageKeyRef.current;
    if (currentKey === 'inactive') return { nextFocus: currentFocus, shouldScroll: false, actionTaken: false };

    const orderedIds = globalOrderedIdsMap.get(currentKey) || [];
    const itemsMap = globalNavigableItemsMap.get(currentKey) || new Map();

    const isMovementKey = ['arrowdown', 'arrowup', 's', 'w'].includes(key);
    const isActionKey = key === ' ';
    const isRightKey = ['arrowright', 'd'].includes(key);
    
    let nextFocus = currentFocus;
    let shouldScroll = false;
    let actionTaken = false;

    if (isMovementKey) {
      actionTaken = true;
      
      // 1. Activation/Initial Focus Check
      if (currentFocus === null && orderedIds.length > 0) {
        const cachedId = getCachedActiveId();
        nextFocus = (cachedId && orderedIds.includes(cachedId)) ? cachedId : orderedIds[0];
        shouldScroll = true;
      } else if (currentFocus !== null) {
        shouldScroll = true;
      } else {
        // No items to focus on
        return { nextFocus: currentFocus, shouldScroll: false, actionTaken: true };
      }

      // 2. Movement Logic
      const currentIndex = nextFocus ? orderedIds.indexOf(nextFocus) : -1;
      let nextIndex = currentIndex;

      if (key === 'arrowdown' || key === 's') {
        nextIndex = Math.min(currentIndex + 1, orderedIds.length - 1);
      } else if (key === 'arrowup' || key === 'w') {
        nextIndex = Math.max(currentIndex - 1, 0);
      }
      
      if (orderedIds.length > 0) {
        nextFocus = orderedIds[nextIndex];
      }

    } else if (isActionKey) {
      actionTaken = true;
      if (currentFocus) {
        const item = itemsMap.get(currentFocus);
        if (item) {
          item.toggleExpand();
          itemsMap.set(currentFocus, { ...item, isExpanded: !item.isExpanded });
          updateOrderedIds(currentKey);
        }
      }
    } else if (isRightKey) {
      // Let the parent component handle right navigation (NewWebsite.tsx)
      actionTaken = true;
    }

    return { nextFocus, shouldScroll, actionTaken };
  }, [getCachedActiveId]);


  // --- Key Buffer Processing Loop ---
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const runProcessor = () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      // 1. Clean up old keys (older than 500ms)
      const now = Date.now();
      keyBufferRef.current = keyBufferRef.current.filter(item => now - item.timestamp < BUFFER_DURATION_MS);

      // 2. Process the next key in the buffer
      const nextKeyEntry = keyBufferRef.current.shift();

      if (nextKeyEntry) {
        const key = nextKeyEntry.key;
        
        // Ensure keyboard mode is active before processing movement/action
        if (!isKeyboardModeActive) {
            setIsKeyboardModeActive(true);
        }

        // Process the key using the current focusedId state
        const { nextFocus, shouldScroll, actionTaken } = processKey(key, focusedId);

        if (actionTaken) {
            // Update focus state if it changed
            if (nextFocus !== focusedId) {
                setFocusedId(nextFocus);
                setCacheActiveId(nextFocus); // Cache the new focus
            }

            // Handle scrolling if necessary
            if (shouldScroll && nextFocus) {
                const element = document.querySelector(`[data-nav-id="${nextFocus}"]`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }
      }
      
      isProcessingRef.current = false;
    };

    // Start the processing interval
    interval = setInterval(runProcessor, PROCESSING_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [focusedId, isKeyboardModeActive, processKey, setCacheActiveId]);


  // --- Keyboard Handler (Only buffers keys now) ---
  useEffect(() => {
    const currentKey = pageKeyRef.current;
    if (currentKey === 'inactive') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA';
      if (isInputFocused) return;

      const key = e.key.toLowerCase();
      const isMovementKey = ['arrowdown', 'arrowup', 's', 'w'].includes(key);
      const isActionKey = key === ' ';
      const isRightKey = ['arrowright', 'd'].includes(key);
      const isNavigationKey = isMovementKey || isActionKey || isRightKey;

      if (!isNavigationKey) return;

      // Prevent default behavior for navigation keys immediately
      e.preventDefault();

      // If mouse is active, ignore keyboard navigation unless it's a movement key
      if (isMouseActive && !isMovementKey) {
        return;
      }

      // Add key to buffer
      keyBufferRef.current.push({ key, timestamp: Date.now() });
      
      // If it's a movement key, ensure keyboard mode is activated immediately
      // This is crucial for cursor hiding, but the actual focus change happens in the loop.
      if (isMovementKey && !isKeyboardModeActive) {
          setIsKeyboardModeActive(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMouseActive, isKeyboardModeActive]); // Dependencies reduced as logic moved to processKey/loop

  // Reset focus when navigating to a new route (even if pageKey remains the same, e.g., project/a to project/b)
  useEffect(() => {
    setFocusedId(null);
    setIsKeyboardModeActive(false);
    // Clear buffer on route change
    keyBufferRef.current = [];
  }, [location.pathname]);

  return { focusedId, registerItem, rebuildOrder, setLastActiveId };
}