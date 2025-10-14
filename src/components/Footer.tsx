"use client";

import React from 'react';
import { Github, Twitter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog'; // Import SettingsDialog

interface FooterProps {
  className?: string;
  isMobile: boolean; // New prop
}

export function Footer({ className, isMobile }: FooterProps) {
  const handleHomeClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Only render the footer if it's NOT mobile landscape
  if (isMobile) {
    return null;
  }

  return (
    <footer className={cn(
      "w-full bg-card border-t border-border py-6 px-4", // Removed mt-8
      "flex flex-col items-center justify-center text-muted-foreground text-sm",
      className
    )}>
      <div className="flex flex-row flex-wrap items-center gap-2 md:gap-4 mb-2">
        <Link to="/" onClick={handleHomeClick} className="hover:text-foreground transition-colors">
          Home
        </Link>
        <span className="hidden md:inline-block text-border">|</span>
        <a 
          href="https://github.com/GGManera/Algojects" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Github className="h-4 w-4" /> GitHub
        </a>
        <span className="hidden md:inline-block text-border">|</span>
        <a 
          href="https://x.com/AlgoJects" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Twitter className="h-4 w-4" /> Twitter
        </a>
        <span className="hidden md:inline-block text-border">|</span>
        {/* Settings Dialog added here */}
        <SettingsDialog />
      </div>
      <p className="text-xs text-muted-foreground">
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