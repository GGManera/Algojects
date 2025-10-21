"use client";

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { MetadataItem } from '@/types/project';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation, globalOrderedIdsMap } from '@/hooks/useKeyboardNavigation'; // Import globalOrderedIdsMap
import { Project } from '@/types/social';
import { UserDisplay } from './UserDisplay';
import { Link as LinkIcon, Copy, Gem, UserCircle, X, Edit, Heart, MessageCircle, MessageSquare, FileText, TrendingUp, DollarSign } from "lucide-react";
import { Button } from './ui/button';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { Skeleton } from './ui/skeleton';
import { showError, showSuccess } from '@/utils/toast';
import { formatLargeNumber, extractDomainFromUrl, extractXHandleFromUrl } from '@/lib/utils';
import { UserProjectTokenHolding } from '@/hooks/useUserProjectTokenHoldings'; // Import UserProjectTokenHolding

interface ProjectMetadataNavigatorProps {
  projectId: string;
  projectMetadata: MetadataItem[];
  currentUserProjectHolding: UserProjectTokenHolding | null;
  tokenHoldingsLoading: boolean;
  projectSourceContext: { path: string; label: string };
  isInsideCarousel?: boolean;
  
  // Props de navegação externa
  isParentFocused: boolean;
  onFocusTransfer: (isInternal: boolean) => void;
  onFocusReturn: (direction: 'up' | 'down') => void;
  setParentFocusedId: (id: string | null) => void; // NEW PROP
}

// Helper function to render individual metadata items (copied logic from ProjectDetailCard)
const renderMetadataItem = (
  item: MetadataItem, 
  index: number, 
  isMobile: boolean, 
  copiedMessage: string | null, 
  handleCopyClick: (e: React.MouseEvent, value: string) => void,
  projectSourceContext: { path: string; label: string }
) => {
  // Base classes for centering and max width
  const baseItemClasses = cn(
    "w-full",
    !isMobile && "max-w-[180px] mx-auto"
  );

  // Skip rendering of "fixed" metadata items here
  if (['project-name', 'project-description', 'whitelisted-editors', 'is-creator-added', 'added-by-address', 'is-community-notes', 'tags', 'is-claimed', 'project-wallet'].includes(item.type || '') || (item.type === 'address' && item.title === 'Creator Wallet')) {
    return null;
  }

  if (item.type === 'url' || (item.value.startsWith('http') && !item.value.includes('x.com') && !item.value.includes('twitter.com'))) {
    return (
      <div
        key={index}
        className={cn("btn-profile", baseItemClasses)}
        onClick={(e) => { e.stopPropagation(); window.open(item.value, '_blank'); }}
        data-nav-id={`meta-${item.title}-${index}`}
      >
        <strong className="uppercase">{item.title || extractDomainFromUrl(item.value)}</strong>
        <div id="container-stars">
          <div id="stars"></div>
        </div>
        <div id="glow">
          <div className="circle"></div>
          <div className="circle"></div>
        </div>
      </div>
    );
  } else if (item.type === 'x-url' || item.value.includes('x.com') || item.value.includes('twitter.com')) {
    return (
      <div
        key={index}
        className={cn("btn-profile", baseItemClasses)}
        onClick={(e) => { e.stopPropagation(); window.open(item.value, '_blank'); }}
        data-nav-id={`meta-${item.title}-${index}`}
      >
        <strong className="uppercase">{item.title || extractXHandleFromUrl(item.value)}</strong>
        <div id="container-stars">
          <div id="stars"></div>
        </div>
        <div id="glow">
          <div className="circle"></div>
          <div className="circle"></div>
        </div>
      </div>
    );
  } else if (item.type === 'asset-id') { // Keep asset-id type, but simplify display
    return (
      <div
        key={index}
        className={cn("btn-profile", baseItemClasses)}
        onClick={(e) => handleCopyClick(e, item.value)}
        data-nav-id={`meta-${item.title}-${index}`}
      >
        <strong className="uppercase">{copiedMessage || item.title || "Asset ID"}</strong>
        <div id="container-stars">
          <div id="stars"></div>
        </div>
        <div id="glow">
          <div className="circle"></div>
          <div className="circle"></div>
        </div>
      </div>
    );
  } else if (item.type === 'address' || item.value.length === 58) {
    return (
      <div key={index} className={cn("inline-flex flex-col items-center p-2 rounded-md bg-background/50 border border-border text-center", baseItemClasses)} data-nav-id={`meta-${item.title}-${index}`}>
        <span className="font-semibold text-muted-foreground text-xs">{item.title || 'Address'}:</span>
        <UserDisplay
          address={item.value}
          textSizeClass="text-sm"
          avatarSizeClass="h-5 w-5"
          linkTo={`/profile/${item.value}`}
          sourceContext={projectSourceContext}
          className="justify-center"
        />
      </div>
    );
  } else {
    return (
      <div key={index} className={cn("inline-flex flex-col items-center p-2 rounded-md bg-background/50 border border-border text-center", baseItemClasses)} data-nav-id={`meta-${item.title}-${index}`}>
        <span className="font-semibold text-muted-foreground text-xs">{item.title}:</span>
        <p className="text-sm text-foreground selectable-text">{item.value}</p>
      </div>
    );
  }
};

export function ProjectMetadataNavigator({
  projectId,
  projectMetadata,
  currentUserProjectHolding,
  tokenHoldingsLoading,
  projectSourceContext,
  isParentFocused,
  onFocusTransfer,
  onFocusReturn,
  setParentFocusedId, // NEW: Accept setParentFocusedId
}: ProjectMetadataNavigatorProps) {
  const { isMobile } = useAppContextDisplayMode();
  const pageKey = `project-metadata-${projectId}`;
  
  // Use a local instance of the navigation hook, only active if the parent is focused
  const { focusedId, registerItem, rebuildOrder, setLastActiveId, isKeyboardModeActive, setFocusedId } = useKeyboardNavigation(isParentFocused ? pageKey : 'inactive');
  
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  // Filter and prepare items for navigation
  const allRenderableMetadataItems = useMemo(() => {
    const items: MetadataItem[] = [];
    const excludedFixedTypes = new Set([
        'project-name', 'project-description', 'whitelisted-editors', 'is-creator-added', 'added-by-address', 'is-community-notes', 'tags', 'is-claimed'
    ]);

    projectMetadata.forEach(item => {
        if (!excludedFixedTypes.has(item.type || '')) {
            items.push(item);
        }
    });
    return items;
  }, [projectMetadata]);

  // Add the holding card as a virtual item if it exists
  const holdingItem = useMemo(() => {
    if (!currentUserProjectHolding) return null;
    return {
      title: 'Your Holding',
      value: `${currentUserProjectHolding.amount} ${currentUserProjectHolding.assetUnitName || ''}`,
      type: 'holding' as const,
    };
  }, [currentUserProjectHolding]);

  const navigableItems = useMemo(() => {
    return [...allRenderableMetadataItems, ...(holdingItem ? [holdingItem] : [])];
  }, [allRenderableMetadataItems, holdingItem]);

  // --- Keyboard Navigation Logic ---

  // 1. Register all items
  useEffect(() => {
    if (!isParentFocused) return;
    
    const cleanupFunctions = navigableItems.map((item, index) => {
      const id = `meta-${item.title}-${index}`;
      // For metadata items, the action is just a click/open link
      const toggleExpand = () => {
        const element = document.querySelector(`[data-nav-id="${id}"]`);
        if (element) {
          (element as HTMLElement).click();
        }
      };
      return registerItem(id, toggleExpand, false, 'project-summary'); // Use project-summary type for simplicity
    });

    // Force rebuild order after registration
    rebuildOrder();

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [isParentFocused, navigableItems, registerItem, rebuildOrder]);

  // 2. Handle focus transfer/return
  useEffect(() => {
    if (!isParentFocused) {
      // When parent loses focus, ensure local focus is cleared
      setFocusedId(null);
      return;
    }

    // When parent gains focus, transfer focus to the first item
    if (isParentFocused && focusedId === null && navigableItems.length > 0) {
      const firstItemId = `meta-${navigableItems[0].title}-${0}`;
      setFocusedId(firstItemId);
      onFocusTransfer(true); // Notify parent that focus is internal
    }
  }, [isParentFocused, focusedId, navigableItems, onFocusTransfer, setFocusedId]);

  // 3. Handle internal movement (up/down) and boundary checks
  useEffect(() => {
    if (!isParentFocused || !isKeyboardModeActive) return;

    const handleInternalMovement = (e: KeyboardEvent) => {
      const orderedIds = globalOrderedIdsMap.get(pageKey) || [];
      if (orderedIds.length === 0) return;

      const key = e.key.toLowerCase();
      const currentIndex = focusedId ? orderedIds.indexOf(focusedId) : -1;

      if (key === 'arrowup' || key === 'w') {
        if (currentIndex === 0) {
          e.preventDefault();
          onFocusReturn('up'); // Return focus to parent
          setFocusedId(null);
          onFocusTransfer(false);
          setParentFocusedId(projectId); // Ensure parent focus is set back to the card
        } else if (currentIndex > 0) {
          e.preventDefault();
          const nextId = orderedIds[currentIndex - 1];
          setFocusedId(nextId);
          document.querySelector(`[data-nav-id="${nextId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else if (key === 'arrowdown' || key === 's') {
        if (currentIndex === orderedIds.length - 1) {
          e.preventDefault();
          onFocusReturn('down'); // Return focus to parent
          setFocusedId(null);
          onFocusTransfer(false);
          setParentFocusedId(projectId); // Ensure parent focus is set back to the card
        } else if (currentIndex < orderedIds.length - 1) {
          e.preventDefault();
          const nextId = orderedIds[currentIndex + 1];
          setFocusedId(nextId);
          document.querySelector(`[data-nav-id="${nextId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };

    window.addEventListener('keydown', handleInternalMovement);
    return () => window.removeEventListener('keydown', handleInternalMovement);
  }, [isParentFocused, isKeyboardModeActive, focusedId, onFocusReturn, onFocusTransfer, pageKey, setFocusedId, setParentFocusedId, projectId]);

  // --- Asset ID Click Handler (for keyboard action) ---
  const handleCopyClick = async (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    if (value) {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedMessage("Copied!");
        setTimeout(() => setCopiedMessage(null), 2000);
      } catch (err) {
        showError("Failed to copy.");
      }
    }
  };

  // --- Rendering ---
  const renderHoldingItem = () => {
    if (!holdingItem) return null;
    
    const isHoldingFocused = focusedId === `meta-${holdingItem.title}-${allRenderableMetadataItems.length}`;
    
    // NEW: Convert raw amount (assumed to be in micro-units, 6 decimals) to display units
    const rawAmount = currentUserProjectHolding?.amount || 0;
    const displayAmount = rawAmount / 1_000_000; // Assuming 6 decimals for scaling

    return (
      <div 
        className={cn(
          "inline-flex flex-col items-center p-2 rounded-md bg-background/50 border border-border text-center", 
          "w-full", 
          !isMobile && "max-w-[180px] mx-auto",
          isHoldingFocused ? "focus-glow-border" : "",
          !isHoldingFocused && "hover:focus-glow-border"
        )}
        data-nav-id={`meta-${holdingItem.title}-${allRenderableMetadataItems.length}`}
        onMouseEnter={() => setLastActiveId(`meta-${holdingItem.title}-${allRenderableMetadataItems.length}`)}
        onMouseLeave={() => setLastActiveId(null)}
      >
        <span className="font-semibold text-muted-foreground text-xs">{holdingItem.title}:</span>
        {tokenHoldingsLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <div className="flex items-center gap-1 justify-center">
            <Gem className="h-4 w-4 text-hodl-blue" />
            <span className="font-numeric font-bold text-primary selectable-text">
              {formatLargeNumber(displayAmount)} {currentUserProjectHolding?.assetUnitName || ''}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-6 px-4 bg-muted/50 text-foreground rounded-md shadow-recessed">
      <div className="grid grid-cols-2 gap-4 text-sm">
        {allRenderableMetadataItems.map((item, index) => {
          const id = `meta-${item.title}-${index}`;
          const isItemFocused = focusedId === id;
          
          // Clone the item renderer to inject focus/hover styles
          const renderedItem = renderMetadataItem(
            item, 
            index, 
            isMobile, 
            copiedMessage, 
            handleCopyClick, 
            projectSourceContext
          );

          if (!renderedItem) return null;

          return React.cloneElement(renderedItem as React.ReactElement, {
            className: cn(
              (renderedItem as React.ReactElement).props.className,
              isItemFocused ? "focus-glow-border" : "",
              !isItemFocused && "hover:focus-glow-border"
            ),
            onMouseEnter: () => setLastActiveId(id),
            onMouseLeave: () => setLastActiveId(null),
          });
        })}
        {renderHoldingItem()}
      </div>
    </div>
  );
}