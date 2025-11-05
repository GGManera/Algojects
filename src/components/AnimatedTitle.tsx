"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedTitleProps {
  className?: string;
  isInsideCarousel?: boolean; // NEW prop
}

export function AnimatedTitle({ className, isInsideCarousel = false }: AnimatedTitleProps) {
  const [showFullTitle, setShowFullTitle] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const T_EXPANDED_MS = 3000; // Duração para "Algorand Projects" (expandido) - 3 segundos
    const T_COLLAPSED_MS = 10000; // Duração para "AlgoJects" (colapsado) - 10 segundos

    const cycleAnimation = () => {
      if (showFullTitle) {
        // Atualmente mostrando "Algorand Projects" (expandido)
        // O próximo estado deve ser "AlgoJects" (colapsado)
        timeoutId = setTimeout(() => {
          setShowFullTitle(false);
        }, T_EXPANDED_MS);
      } else {
        // Atualmente mostrando "AlgoJects" (colapsado)
        // O próximo estado deve ser "Algorand Projects" (expandido)
        timeoutId = setTimeout(() => {
          setShowFullTitle(true);
        }, T_COLLAPSED_MS);
      }
    };

    // Inicia o ciclo de animação
    cycleAnimation();

    return () => clearTimeout(timeoutId);
  }, [showFullTitle]); // Reexecuta o efeito quando showFullTitle muda

  return (
    <div className={cn(
      "flex items-center justify-center text-3xl sm:text-4xl md:text-6xl font-bold tracking-wide font-heading whitespace-nowrap", // Adjusted text sizes
      "leading-relaxed md:leading-loose",
      // Removed: !isInsideCarousel && "min-w-[300px] sm:min-w-[500px] md:min-w-[800px]", 
      className
    )}>
      <span className="gradient-text inline-block">
        Algo
      </span>
      <AnimatePresence mode="wait">
        {showFullTitle && (
          <motion.span
            key="rand-pro"
            initial={{ opacity: 0, width: 0, display: 'inline-block' }}
            animate={{ opacity: 1, width: 'auto', transition: { duration: 0.5 } }}
            exit={{ opacity: 0, width: 0, transition: { duration: 0.5 } }}
            className="gradient-text inline-block whitespace-nowrap"
          >
            rand Pro
          </motion.span>
        )}
      </AnimatePresence>
      <span className="gradient-text inline-block">
        Jects
      </span>
    </div>
  );
}