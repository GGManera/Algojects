"use client";

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Repeat2 } from 'lucide-react';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { cn } from '@/lib/utils';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode

interface DynamicNavButtonsProps {
  onCenterButtonClick: () => void; // NEW prop
}

export function DynamicNavButtons({ onCenterButtonClick }: DynamicNavButtonsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, appDisplayMode, isDeviceLandscape } = useAppContextDisplayMode(); // Use the hook
  const {
    lastProjectPath,
    lastProfilePath,
    profile1,
    profile2,
    currentProfileSlot,
    historyStack, // NEW: Access historyStack
  } = useNavigationHistory();

  // Determine if the current page is a profile page
  const isProfilePage = location.pathname.startsWith('/profile/');
  const isProjectPage = location.pathname.startsWith('/project/');
  const isHomePage = location.pathname === '/';

  // --- Left Button Logic ---
  let leftButton: { label: string; path: string } | null = null;

  if (isProjectPage) {
    // Project Page: Always "Back to All Projects"
    leftButton = { label: 'All Projects', path: '/' };
  } else if (isProfilePage) {
    // Profile Page: "Back to Last Project" if available, else "Back to All Projects"
    if (lastProjectPath) {
      leftButton = { label: lastProjectPath.label, path: lastProjectPath.path };
    } else {
      leftButton = { label: 'All Projects', path: '/' };
    }
  } else if (isHomePage) { // NEW: For home page
    leftButton = null; // No left button on home page
  }

  // --- Right Button Logic ---
  // Update type to include state
  let rightButton: { label: string; path: string; action?: 'switchProfile'; state?: { initialActiveCategory: 'writing' | 'curating' } } | null = null;

  if (isProjectPage) {
    // Project Page: "Back to Last Profile" if available
    if (lastProfilePath) {
      rightButton = { label: 'Profile', path: lastProfilePath.path };
      // NEW: Add state to the link
      if (lastProfilePath.activeCategory) {
        rightButton.state = { initialActiveCategory: lastProfilePath.activeCategory };
      }
    }
  } else if (isProfilePage) {
    // Profile Page: "Switch Profile" if two distinct profiles are stored
    const currentProfileAddress = location.pathname.split('/')[2];
    const otherProfile = (currentProfileSlot === 1 && profile2 && profile2.address !== currentProfileAddress)
      ? profile2
      : (currentProfileSlot === 2 && profile1 && profile1.address !== currentProfileAddress)
        ? profile1
        : null;

    if (otherProfile) {
      rightButton = { label: 'Switch Profile', path: `/profile/${otherProfile.address}`, action: 'switchProfile' };
      // NEW: When switching profile, try to maintain the current category if available
      const currentProfileEntry = historyStack.find(entry => entry.path === location.pathname);
      if (currentProfileEntry?.activeCategory) {
        rightButton.state = { initialActiveCategory: currentProfileEntry.activeCategory };
      }
    }
  } else if (isHomePage) { // NEW: For home page
    if (lastProjectPath) {
      rightButton = { label: 'Project', path: lastProjectPath.path }; // Changed label to "Go to Project"
    } else {
      rightButton = null; // No right button if no last project
    }
  }

  // --- Current Slide Name Display Logic ---
  let currentSlideName = "Home";
  if (isProjectPage) {
    currentSlideName = "Project";
  } else if (isProfilePage) {
    currentSlideName = "Profile";
  }

  return (
    <div className={cn(
      "fixed left-0 right-0 z-30 w-full bg-hodl-darker",
      // Apply fixed height to the container in both mobile portrait and desktop/landscape
      "h-[var(--dynamic-nav-buttons-height)]",
      (isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape) // Mobile portrait
        ? "bottom-[var(--mobile-bottom-bar-height)] border-t border-border-accent-green top-border-glow"
        : "top-[calc(var(--sticky-header-height)+var(--dynamic-nav-buttons-desktop-vertical-gap))] border-b border-border-accent-green bottom-border-glow" // Desktop/Landscape
    )}>
      <div className="relative w-full max-w-3xl mx-auto flex justify-between items-center px-2 h-full">
        {leftButton ? (
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground h-6 px-2" 
          >
            <Link to={leftButton.path}>
              <ArrowLeft className="h-4 w-4" />
              {leftButton.label}
            </Link>
          </Button>
        ) : (
          <div className="w-24"></div>
        )}

        {/* Current Slide Name Display with btn-profile styling */}
        <div className="absolute left-1/2 -translate-x-1/2 flex justify-center z-10">
          <div 
            className={cn(
              "btn-profile !w-auto !min-w-[72px] !max-w-[108px]", // Use default btn-profile height (2rem/32px)
            )}
            onClick={onCenterButtonClick} // NEW: Add onClick handler
          >
            <strong className="uppercase text-[9px]">{currentSlideName}</strong>
            <div id="container-stars">
              <div id="stars"></div>
            </div>
            <div id="glow">
              <div className="circle"></div>
              <div className="circle"></div>
            </div>
          </div>
        </div>

        {rightButton ? (
          <Button 
            variant="ghost" 
            size="sm" 
            asChild 
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground h-6 px-2" 
          >
            <Link to={rightButton.path} state={rightButton.state}>
              {rightButton.label}
              {rightButton.action === 'switchProfile' && <Repeat2 className="h-4 w-4" />}
              {rightButton.action !== 'switchProfile' && <ArrowLeft className="h-4 w-4 rotate-180" />}
            </Link>
          </Button>
        ) : (
          <div className="w-24"></div>
        )}
      </div>
    </div>
  );
}