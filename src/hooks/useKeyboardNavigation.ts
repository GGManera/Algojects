"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface NavigableItem {
  id: string;
  toggleExpand: () => void;
  isExpanded: boolean;
  type: 'review' | 'comment' | 'reply' | 'project-summary';
}

// Global map to hold all registered items for the current page
const navigableItemsMap = new Map<string, NavigableItem>();
let orderedIds: string[] = [];

// Function to update the ordered list of IDs based on DOM order
const updateOrderedIds = () => {
  // We target the main content area of the active carousel item
  const container = document.querySelector('.carousel-item-active'); 
  if (!container) return;

  // Find all elements that are registered (have an ID in the map) and are visible
  const elements = Array.from(container.querySelectorAll('[data-nav-id]')) as HTMLElement[];
  
  // Filter out elements that are hidden (e.g., excluded posts)
  orderedIds = elements
    .map(el => el.getAttribute('data-nav-id'))
    .filter((id): id is string => id !== null && navigableItemsMap.has(id));
};

// Debounced function to update IDs
let updateTimeout: NodeJS.Timeout;
const debouncedUpdateOrderedIds = () => {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(updateOrderedIds, 50);
};


export function useKeyboardNavigation(pageKey: string) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const location = useLocation();
  const pageKeyRef = useRef(pageKey);
  pageKeyRef.current = pageKey;

  // --- Registration Management ---
  const registerItem = useCallback((id: string, toggleExpand: () => void, isExpanded: boolean, type: NavigableItem['type']) => {
    navigableItemsMap.set(id, { id, toggleExpand, isExpanded, type });
    debouncedUpdateOrderedIds();

    return () => {
      navigableItemsMap.delete(id);
      debouncedUpdateOrderedIds();
    };
  }, []);

  // --- Keyboard Handler ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle navigation if we are on the currently active slide
      const activeSlideElement = document.querySelector('.carousel-item-active');
      // Check if the active slide contains an element with the pageKey ID (e.g., the main scroll container)
      if (!activeSlideElement || !activeSlideElement.querySelector(`#${pageKeyRef.current}`)) {
        return;
      }

      const isInputFocused = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA';
      if (isInputFocused) return;

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
          const item = navigableItemsMap.get(focusedId);
          if (item) {
            item.toggleExpand();
            // Update the map immediately after toggling
            navigableItemsMap.set(focusedId, { ...item, isExpanded: !item.isExpanded });
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
  }, [focusedId, location.pathname]);

  // Reset focus when navigating to a new page
  useEffect(() => {
    setFocusedId(null);
    navigableItemsMap.clear();
    orderedIds = [];
  }, [location.pathname]);

  return { focusedId, registerItem };
}