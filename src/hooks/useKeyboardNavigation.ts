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
export const globalNavigableItemsMap = new Map<string, Map<string, NavigableItem>>();
// Global map to hold the ordered IDs for each pageKey
export const globalOrderedIdsMap = new Map<string, string[]>();

const LAST_ACTIVE_ID_KEY = 'algojects_last_active_id';

// Function to update the ordered list of IDs based on DOM order for a specific pageKey
const updateOrderedIds = (pageKey: string) => {
  const container = document.getElementById(pageKey); 
  if (!container) return;

  // Find all elements that have the data attribute in DOM order
  const elements = Array.from(container.querySelectorAll('[data-nav-id]')) as HTMLElement[];
  
  const currentItemsMap = globalNavigableItemsMap.get(pageKey) || new Map();

  // 1. Get all registered IDs in DOM order
  const orderedRegisteredIds = elements
    .map(el => el.getAttribute('data-nav-id'))
    .filter((id): id is string => id !== null && currentItemsMap.has(id));

  const finalOrderedIds: string[] = [];

  // 2. Filter based on hierarchy and expansion state
  orderedRegisteredIds.forEach(id => {
    const item = currentItemsMap.get(id);
    if (!item) return; // Should not happen due to filter above, but safe guard

    const parts = id.split('.');
    
    // Project Summary cards are always visible on the Projects page.
    if (item.type === 'project-summary') {
        finalOrderedIds.push(id);
        return;
    }
    
    // Logic for Review, Comment, Reply (ProjectPage/UserProfile)
    
    // Check Review Parent (applies to Comment and Reply)
    if (item.type === 'comment' || item.type === 'reply') {
        // Ensure ID has at least two parts (e.g., reviewId.commentId)
        if (parts.length < 2) {
            return;
        }
        
        // Review ID is parts[0].parts[1] (e.g., d.a)
        const reviewId = `${parts[0]}.${parts[1]}`;
        const reviewItem = currentItemsMap.get(reviewId);
        
        // If the review exists AND is collapsed, skip this item and its children.
        if (reviewItem && !reviewItem.isExpanded) {
            return;
        }
    }
    
    // Check Comment Parent (applies only to Reply)
    if (item.type === 'reply') {
        // Ensure ID has at least three parts (e.g., reviewId.commentId.replyId)
        if (parts.length < 3) {
            return;
        }
        
        // Comment ID is parts[0].parts[1].parts[2] (e.g., d.a.b)
        const commentId = `${parts[0]}.${parts[1]}.${parts[2]}`;
        const commentItem = currentItemsMap.get(commentId);
        
        // If the comment exists AND is collapsed (meaning replies are hidden), skip this reply.
        if (commentItem && !commentItem.isExpanded) {
            return;
        }
    }

    // If it passed all checks, it's visible.
    finalOrderedIds.push(id);
  });
    
  globalOrderedIdsMap.set(pageKey, finalOrderedIds);
  return finalOrderedIds;
};

export function useKeyboardNavigation(pageKey: string) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isMouseActive, setIsMouseActive] = useState(false);
  const [isKeyboardModeActive, setIsKeyboardModeActive] = useState(false); // Export this state
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
    
    // Store or update the item with its current expansion state
    itemsMap.set(id, { id, toggleExpand, isExpanded, type });
    updateOrderedIds(currentKey); // Rebuild order immediately upon registration/update

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
    if (focusedId === null && orderedIds && orderedIds.length > 0) {
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

      // If mouse is active, ignore keyboard navigation unless it's a movement key
      if (isMouseActive && !isMovementKey) {
        e.preventDefault();
        return;
      }

      // --- Activation Logic ---
      let currentFocus = focusedId;
      let shouldScroll = false;
      let activateKeyboardMode = false;

      if (isMovementKey) {
        e.preventDefault(); // Prevent default scroll behavior for movement keys
        
        if (!isKeyboardModeActive) {
          activateKeyboardMode = true;
          setIsKeyboardModeActive(true);
        }

        if (currentFocus === null && orderedIds.length > 0) {
          // If no focus is set, try to restore from cache or default to first item
          const cachedId = getCachedActiveId();
          currentFocus = (cachedId && orderedIds.includes(cachedId)) ? cachedId : orderedIds[0];
          shouldScroll = true; // Scroll to the initial focus
        } else if (currentFocus !== null) {
          shouldScroll = true;
        }
      }

      if (!isKeyboardModeActive && !activateKeyboardMode) return; // Only proceed if active or just activated

      // --- Movement Logic ---
      const currentIndex = currentFocus ? orderedIds.indexOf(currentFocus) : -1;
      let nextIndex = currentIndex;

      if (key === 'arrowdown' || key === 's') {
        nextIndex = Math.min(currentIndex + 1, orderedIds.length - 1);
      } else if (key === 'arrowup' || key === 'w') {
        nextIndex = Math.max(currentIndex - 1, 0);
      } else if (isActionKey) {
        if (currentFocus) {
          // Always prevent default scroll behavior if an item is focused and space is pressed
          e.preventDefault(); 
          
          const item = itemsMap.get(currentFocus);
          
          // Only execute toggleExpand if the item is designed to be expandable.
          const isExpandable = item && (item.type === 'review' || item.type === 'comment' || item.type === 'reply');

          if (isExpandable) {
            item.toggleExpand();
            // Update the item's state in the map and rebuild order immediately
            itemsMap.set(currentFocus, { ...item, isExpanded: !item.isExpanded });
            updateOrderedIds(currentKey);
          } else {
            // If the item is not expandable (like the Logo/project-summary), 
            // and space is pressed, execute the toggleExpand function (which might be onScrollToTop)
            item?.toggleExpand();
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
        
        // Only update focus if it's actually changing, or if we are initializing focus
        if (nextId !== focusedId || focusedId === null) {
            setFocusedId(nextId);
        }
        
        if (shouldScroll) {
            const element = document.querySelector(`[data-nav-id="${nextId}"]`);
            
            if (element) {
                // If moving to the first item (index 0), call toggleExpand (which is onScrollToTop)
                if (nextIndex === 0) {
                    const item = itemsMap.get(nextId);
                    item?.toggleExpand(); // This triggers the scroll to top
                } else {
                    // Otherwise, use 'nearest' for smooth navigation between items.
                    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
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

  return { focusedId, setFocusedId, registerItem, rebuildOrder, setLastActiveId, isKeyboardModeActive };
}