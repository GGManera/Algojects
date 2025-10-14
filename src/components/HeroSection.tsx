"use client";

import React from 'react';
import { AnimatedTitle } from '@/components/AnimatedTitle';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  heroLogoRef: React.RefObject<HTMLDivElement>;
  isInsideCarousel?: boolean;
  className?: string;
}

export function HeroSection({ heroLogoRef, isInsideCarousel, className }: HeroSectionProps) {
  return (
    <div className={cn("text-center py-8 md:pb-12", className)}>
      <div
        ref={heroLogoRef}
        className="p-4 rounded-xl bg-gradient-to-br from-hodl-darker to-hodl-dark shadow-deep-lg inline-block"
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