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

  // Effect to clear keyboard focus when mouse becomes active
  useEffect(() => {
    if (isMouseActive && focusedId !== null) {
      // When mouse moves, clear keyboard focus
      setFocusedId(null);
    }
  }, [isMouseActive, focusedId]);

  // Effect to update cache when focusedId changes (only if it's a keyboard-driven change)
  // NOTE: We rely on setCacheActiveId being called by setLastActiveId (hover) or explicitly in handleKeyDown (movement)
  // We remove the implicit cache update here to avoid conflicts when isMouseActive flips.
  /*
  useEffect(() => {
    if (focusedId !== null && !isMouseActive) {
      setCacheActiveId(focusedId);
    }
  }, [focusedId, isMouseActive, setCacheActiveId]);
  */


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
    
    // When rebuilding, if focusedId is invalid or null, try to restore from cache
    if (focusedId === null || !orderedIds.includes(focusedId)) {
        const cachedId = getCachedActiveId();
        if (cachedId && orderedIds.includes(cachedId)) {
            setFocusedId(cachedId);
        } else if (orderedIds.length > 0) {
            setFocusedId(orderedIds[0]);
        } else {
            setFocusedId(null);
        }
    }
    return orderedIds;
  }, [focusedId, getCachedActiveId]);

  // --- Mouse Hover Tracking (External API) ---
  const setLastActiveId = useCallback((id: string | null) => {
    // Always update the cache when hover occurs (mouse enter/leave)
    setCacheActiveId(id);
  }, [setCacheActiveId]);


  // --- Effect to manage focus state and cleanup when pageKey changes ---
  useEffect(() => {
    const currentKey = pageKeyRef.current;
    
    if (currentKey === 'inactive') {
      setFocusedId(null);
      return;
    }

    // Reset focus when the pageKey changes (e.g., navigating from project/a to project/b)
    setFocusedId(null);
    
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

      const isMovementKey = ['ArrowDown', 'ArrowUp', 's', 'w'].includes(e.key) || ['ArrowDown', 'ArrowUp', 's', 'w'].includes(e.key.toLowerCase());
      const isActionKey = e.key === ' ';
      const isNavigationKey = isMovementKey || isActionKey;

      if (!isNavigationKey) return;

      // If mouse is active, ignore keyboard navigation
      if (isMouseActive) {
        // Allow spacebar action if mouse is active, but prevent default scrolling
        if (isActionKey) {
            e.preventDefault();
        }
        return;
      }

      // --- Focus Restoration / Initialization ---
      let currentFocus = focusedId;
      let shouldScroll = false;

      if (currentFocus === null && orderedIds.length > 0) {
        // If no item is focused (e.g., just switched to keyboard mode), restore from cache
        const cachedId = getCachedActiveId();
        if (cachedId && orderedIds.includes(cachedId)) {
            currentFocus = cachedId;
        } else {
            currentFocus = orderedIds[0];
        }
        setFocusedId(currentFocus);
        
        // If it's a movement key, scroll to the restored item
        if (isMovementKey) {
            shouldScroll = true;
        }
      } else if (isMovementKey) {
        // If focus is already set and a movement key is pressed, we should scroll.
        shouldScroll = true;
      }
      
      if (!currentFocus) return; // Should not happen if orderedIds.length > 0

      const currentIndex = orderedIds.indexOf(currentFocus);
      let nextId = currentFocus;

      if (isMovementKey) {
        e.preventDefault();
        let nextIndex = currentIndex;
        if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
          nextIndex = Math.min(currentIndex + 1, orderedIds.length - 1);
        } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
          nextIndex = Math.max(currentIndex - 1, 0);
        }
        nextId = orderedIds[nextIndex];
        
        // Update cache and focus ID on movement
        setFocusedId(nextId);
        setCacheActiveId(nextId);

      } else if (isActionKey) { // Spacebar
        e.preventDefault();
        const item = itemsMap.get(currentFocus);
        if (item) {
          item.toggleExpand();
          itemsMap.set(currentFocus, { ...item, isExpanded: !item.isExpanded });
          updateOrderedIds(currentKey);
        }
        return;
      }

      if (shouldScroll) {
          const element = document.querySelector(`[data-nav-id="${nextId}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedId, pageKey, isMouseActive, getCachedActiveId, setCacheActiveId]);

  // Reset focus when navigating to a new route (even if pageKey remains the same, e.g., project/a to project/b)
  useEffect(() => {
    setFocusedId(null);
  }, [location.pathname]);

  return { focusedId, registerItem, rebuildOrder, setLastActiveId };
}