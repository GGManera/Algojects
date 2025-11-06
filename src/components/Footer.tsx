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
      <div className={cn(
        "flex items-center gap-2 md:gap-4 mb-2",
        isMobile ? "grid grid-cols-2 gap-x-4 gap-y-2" : "flex-row flex-wrap" // Use grid for mobile, flex for desktop
      )}>
        <Link to="/" onClick={handleHomeClick} className="hover:text-foreground transition-colors flex items-center justify-center">
          Home
        </Link>
        <span className={cn("text-border", isMobile && "hidden")}>|</span>
        <a 
          href="https://github.com/GGManera/Algojects" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-1 hover:text-foreground transition-colors justify-center"
        >
          <Github className="h-4 w-4" /> GitHub
        </a>
        <span className={cn("text-border", isMobile && "hidden")}>|</span>
        <a 
          href="https://x.com/AlgoJects" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-1 hover:text-foreground transition-colors justify-center"
        >
          <Twitter className="h-4 w-4" /> Twitter
        </a>
        <span className={cn("text-border", isMobile && "hidden")}>|</span>
        <Link to="/feedback" className="hover:text-foreground transition-colors flex items-center justify-center">
          Feedback
        </Link>
        <span className={cn("text-border", isMobile && "hidden")}>|</span>
        {/* Settings Dialog takes full width on mobile grid */}
        <div className={cn(isMobile && "col-span-2 flex justify-center")}>
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