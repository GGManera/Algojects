"use client";

import React, { useCallback, useEffect } from 'react';
import { AnimatedTitle } from '@/components/AnimatedTitle';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'; // NEW Import

interface HeroSectionProps {
  heroLogoRef: React.RefObject<HTMLDivElement>;
  isInsideCarousel?: boolean;
  className?: string;
  // NEW: Keyboard navigation props
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean;
  setLastActiveId: ReturnType<typeof useKeyboardNavigation>['setLastActiveId'];
  onScrollToTop: () => void; // NEW prop to trigger scroll to top
}

export function HeroSection({ heroLogoRef, isInsideCarousel, className, focusedId, registerItem, isActive, setLastActiveId, onScrollToTop }: HeroSectionProps) {
  
  const isFocused = focusedId === 'hero-logo';

  const handleToggleExpand = useCallback(() => {
    // When spacebar is pressed on the logo, scroll to top
    // This function is also called by useKeyboardNavigation when index 0 is focused via W/ArrowUp
    onScrollToTop();
  }, [onScrollToTop]);

  // Register item for keyboard navigation
  useEffect(() => {
    // Register the logo as a non-expandable item (isExpanded: true)
    const cleanup = registerItem('hero-logo', handleToggleExpand, true, 'project-summary');
    return cleanup;
  }, [handleToggleExpand, registerItem, isActive]);

  return (
    <div className={cn("text-center py-8 md:pb-12 relative", className)}>
      <div
        ref={heroLogoRef}
        className={cn(
          "p-4 rounded-xl bg-gradient-to-br from-hodl-darker to-hodl-dark shadow-deep-lg cursor-pointer transition-all duration-200 border-2 border-transparent",
          "block mx-auto w-fit", // Explicitly center the logo wrapper
          isFocused ? "focus-glow-border" : "",
          !isFocused && "hover:focus-glow-border"
        )}
        onClick={onScrollToTop}
        onMouseEnter={() => setLastActiveId('hero-logo')}
        onMouseLeave={() => setLastActiveId(null)}
        data-nav-id="hero-logo"
      >
        <img
          src="/algojects-logo.png"
          alt="AlgoJects Logo"
          className="w-48 md:w-64 h-auto mx-auto"
        />
      </div>
      
      {/* AnimatedTitle agora com margens para espaçamento */}
      <AnimatedTitle className="mt-10 md:mt-[56px] mb-4" isInsideCarousel={isInsideCarousel} />
      
      {/* Subtítulo com margens ajustadas */}
      <p className="text-blue-200 mt-4 md:mt-6">
        Project Review Portal on Algorand
      </p>
    </div>
  );
}