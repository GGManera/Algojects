"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog';
import { WalletButton } from '@txnlab/use-wallet-ui-react';
import { useHeroLogoVisibility } from '@/contexts/HeroLogoVisibilityContext';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { ProfileButton } from './ProfileButton';

interface StickyHeaderProps {
  onLogoClick: (e: React.MouseEvent) => void; // NEW prop
}

export function StickyHeader({ onLogoClick }: StickyHeaderProps) {
  const { isHeroLogoVisible } = useHeroLogoVisibility();
  const { isMobile } = useAppContextDisplayMode();
  // const navigate = useNavigate(); // Removed useNavigate as navigation is handled by onLogoClick

  return (
    <AnimatePresence>
      <motion.header
        initial={{ y: "-100%", opacity: 0 }}
        animate={{ y: "0%", opacity: 1 }}
        exit={{ y: "-100%", opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={cn(
          "fixed top-0 left-0 right-0 z-40",
          "flex items-center justify-between px-4 py-2",
          "bg-hodl-darker border-b border-border-accent-green shadow-deep-md"
        )}
      >
        <div className="flex items-center space-x-2">
          <Link to="/" onClick={onLogoClick} className="flex items-center flex-grow justify-center">
            <img 
              src="/algojects-logo.png" 
              alt="AlgoJects Logo" 
              className="h-8 w-auto" 
            />
          </Link>
        </div>
        <div className="flex items-center space-x-2">
          <ProfileButton />
          <WalletButton />
        </div>
      </motion.header>
    </AnimatePresence>
  );
}