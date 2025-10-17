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
    onScrollToTop();
  }, [onScrollToTop]);

  // Register item for keyboard navigation
  useEffect(() => {
    // Register the logo as a non-expandable item (isExpanded: true)
    const cleanup = registerItem('hero-logo', handleToggleExpand, true, 'project-summary');
    return cleanup;
  }, [handleToggleExpand, registerItem, isActive]);

  return (
    <div className={cn("text-center py-8 md:pb-12", className)}>
      <div
        ref={heroLogoRef}
        className={cn(
          "p-4 rounded-xl bg-gradient-to-br from-hodl-darker to-hodl-dark shadow-deep-lg inline-block cursor-pointer transition-all duration-200 border-2 border-transparent",
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
      <AnimatedTitle className="mt-4 mb-4" isInsideCarousel={isInsideCarousel} />
      <p className="text-blue-200 mt-[-10px] md:mt-[-30px]">
        Project Review Portal on Algorand
      </p>
    </div>
  );
}