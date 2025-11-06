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
      {isMobile ? (
        <div className="flex flex-col items-center w-full max-w-md mb-2 space-y-4">
          {/* Centered grid for links */}
          <div className="grid grid-cols-2 gap-x-8 w-full max-w-[250px] mx-auto">
            <div className="flex flex-col items-start gap-y-2"> {/* Left column */}
              <Link to="/" onClick={handleHomeClick} className="hover:text-foreground transition-colors">Home</Link>
              <Link to="/feedback" className="hover:text-foreground transition-colors">Feedback</Link>
              <Link to="/governance" className="hover:text-foreground transition-colors">Governance</Link>
            </div>
            <div className="flex flex-col items-start gap-y-2"> {/* Right column */}
              <a
                href="https://github.com/GGManera/Algojects"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Github className="h-4 w-4" /> GitHub
              </a>
              <a
                href="https://x.com/AlgoJects"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Twitter className="h-4 w-4" /> Twitter
              </a>
            </div>
          </div>
          {/* Settings button centered below links */}
          <div className="flex-shrink-0">
            <SettingsDialog />
          </div>
        </div>
      ) : (
        // Desktop layout (reverted to original)
        <div className="flex w-full max-w-md items-center justify-between mb-2">
          {/* Left group of links (Home, Feedback, Governance) */}
          <div className="flex flex-row items-center gap-4">
            <Link to="/" onClick={handleHomeClick} className="hover:text-foreground transition-colors">Home</Link>
            <span className="text-border">|</span>
            <Link to="/feedback" className="hover:text-foreground transition-colors">Feedback</Link>
            <span className="text-border">|</span>
            <Link to="/governance" className="hover:text-foreground transition-colors">Governance</Link>
          </div>

          {/* Right group of links (GitHub, Twitter) */}
          <div className="flex flex-row items-center gap-4">
            <a
              href="https://github.com/GGManera/Algojects"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
            <span className="text-border">|</span>
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
      )}
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