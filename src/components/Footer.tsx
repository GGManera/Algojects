"use client";

import React from 'react';
import { Github, Twitter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog'; // Import SettingsDialog
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const { isMobile } = useAppContextDisplayMode(); // Use the hook to check if it's mobile

  const handleHomeClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className={cn(
      "w-full bg-card border-t border-border py-6 px-4 mt-8",
      "flex flex-col items-center justify-center text-muted-foreground text-sm",
      className
    )}>
      <div className="flex w-full max-w-md items-center justify-between mb-2">
        {/* Left group of links (Home, Feedback) */}
        <div className={cn(
          "flex flex-col gap-y-2", // Stack vertically on mobile
          !isMobile && "flex-row items-center gap-4" // Horizontal on desktop
        )}>
          <Link to="/" onClick={handleHomeClick} className="hover:text-foreground transition-colors">
            Home
          </Link>
          {!isMobile && <span className="text-border">|</span>}
          <Link to="/feedback" className="hover:text-foreground transition-colors">
            Feedback
          </Link>
        </div>

        {/* Right group of links (GitHub, Twitter) */}
        <div className={cn(
          "flex flex-col gap-y-2", // Stack vertically on mobile
          !isMobile && "flex-row items-center gap-4" // Horizontal on desktop
        )}>
          <a
            href="https://github.com/GGManera/Algojects"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
          {!isMobile && <span className="text-border">|</span>}
          <a
            href="https://x.com/AlgoJects"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Twitter className="h-4 w-4" /> Twitter
          </a>
        </div>

        {/* Settings button on the far right */}
        <div className="flex-shrink-0">
          <SettingsDialog />
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        &copy; {new Date().getFullYear()} AlgoJects. Powered by{' '}
        <a
          href="https://hodlverse.co"
          target="_blank"
          rel="noopener noreferrer"
          className="text-hodl-blue hover:underline"
        >
          HODLverse
        </a>.
      </p>
    </footer>
  );
}