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
  const location = useLocation();
  const pageKeyRef = useRef(pageKey);
  pageKeyRef.current = pageKey;

  // --- Registration Management ---
  const registerItem = useCallback((id: string, toggleExpand: () => void, isExpanded: boolean, type: NavigableItem['type']) => {
    const currentKey = pageKeyRef.current;
    if (currentKey === 'inactive') return () => {};

    if (!globalNavigableItemsMap.has(currentKey)) {
      globalNavigableItemsMap.set(currentKey, new Map());
    }
    const itemsMap = globalNavigableItemsMap.get(currentKey)!;
    
    // Update item details
    itemsMap.set(id, { id, toggleExpand, isExpanded, type });
    
    // Immediately update the ordered list (this is necessary for dynamic content like comments/replies)
    updateOrderedIds(currentKey);

    return () => {
      // Only delete if the pageKey hasn't changed (i.e., we are cleaning up on the same page)
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
    console.log(`[KeyboardNav] Explicit Rebuild for ${currentKey}. Total items: ${orderedIds.length}`);
    
    // If focus was lost, try to restore it to the first item
    if (focusedId === null && orderedIds.length > 0) {
        setFocusedId(orderedIds[0]);
    }
    return orderedIds; // Return ordered IDs for external use
  }, [focusedId]);


  // --- Effect to manage focus state and cleanup when pageKey changes ---
  useEffect(() => {
    const currentKey = pageKeyRef.current;
    
    if (currentKey === 'inactive') {
      setFocusedId(null);
      return;
    }

    // 1. Reset focus
    setFocusedId(null);
    
    // 2. Cleanup function for when the component unmounts or pageKey changes
    return () => {
      // When the page becomes inactive, clear its state from the global maps
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

      const currentIndex = focusedId ? orderedIds.indexOf(focusedId) : -1;
      let nextIndex = currentIndex;

      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        nextIndex = Math.min(currentIndex + 1, orderedIds.length - 1);
      } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        e.preventDefault();
        nextIndex = Math.max(currentIndex - 1, 0);
      } else if (e.key === ' ') {
        if (focusedId) {
          e.preventDefault();
          const item = itemsMap.get(focusedId);
          if (item) {
            item.toggleExpand();
            // Update the map immediately after toggling
            itemsMap.set(focusedId, { ...item, isExpanded: !item.isExpanded });
            // Rebuild order in case expansion/collapse changed DOM layout significantly (e.g., showing comments)
            updateOrderedIds(currentKey);
          }
        }
        return;
      } else {
        return;
      }

      if (orderedIds.length > 0) {
        // If no item was focused, start at the top
        if (currentIndex === -1) {
            nextIndex = 0;
        }
        
        const nextId = orderedIds[nextIndex];
        setFocusedId(nextId);
        
        // Scroll the focused item into view if it's not visible
        const element = document.querySelector(`[data-nav-id="${nextId}"]`);
        if (element) {
          // Use scrollIntoView with 'start' and rely on CSS scroll-margin-top
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedId, pageKey]);

  // Reset focus when navigating to a new route (even if pageKey remains the same, e.g., project/a to project/b)
  useEffect(() => {
    setFocusedId(null);
  }, [location.pathname]);

  return { focusedId, registerItem, rebuildOrder };
}