"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Home, Plus, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWallet } from "@txnlab/use-wallet-react";
import { WalletButton } from '@txnlab/use-wallet-ui-react';
import { AddActionSheet } from './AddActionSheet';
import { ProjectsData } from '@/types/social';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';

interface MobileBottomBarProps {
  projects: ProjectsData;
  onInteractionSuccess: () => void;
}

export function MobileBottomBar({ projects, onInteractionSuccess }: MobileBottomBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeAddress } = useWallet();
  const { getCurrentEntry } = useNavigationHistory();

  const handleHomeClick = () => {
    // This forces a navigation to the home page and a full page reload,
    // which is a common behavior for a main logo/brand icon click.
    window.location.href = '/';
  };

  const handleProfileClick = () => {
    const currentEntry = getCurrentEntry();
    let initialActiveCategory: 'writing' | 'curating' | undefined;

    // If the current page is a profile, and it has an activeCategory, use that
    if (currentEntry?.path.startsWith('/profile/') && currentEntry.activeCategory) {
      initialActiveCategory = currentEntry.activeCategory;
    } else if (currentEntry?.path === '/') {
      // If coming from home, default to 'writing'
      initialActiveCategory = 'writing';
    }
    
    navigate(`/profile/${activeAddress}`, { state: { initialActiveCategory } });
  };

  const isOnOwnProfilePage = activeAddress && location.pathname.startsWith(`/profile/${activeAddress}`);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-hodl-darker border-t border-border-accent-green z-50 h-16 grid grid-cols-3 items-center md:hidden">
      {/* Column 1: AlgoJects Logo */}
      <Button variant="ghost" size="icon" onClick={handleHomeClick} className="flex flex-col h-full w-full justify-center items-center text-muted-foreground hover:text-foreground rounded-none">
        <img 
          src="/algojects-logo.png" 
          alt="AlgoJects Logo" 
          className="h-8 w-auto" 
        />
      </Button>

      {/* Column 2: Add Button / Placeholder */}
      {activeAddress ? (
        <AddActionSheet projects={projects} onInteractionSuccess={onInteractionSuccess}>
          <Button variant="ghost" size="icon" className="flex flex-col h-full w-full justify-center items-center text-muted-foreground hover:text-foreground rounded-none">
            <Plus className="h-5 w-5" />
            <span className="text-xs">Add</span>
          </Button>
        </AddActionSheet>
      ) : (
        <div className="h-full w-full"></div> // Placeholder to maintain column 2
      )}
      
      {/* Column 3: Profile / Wallet / Connect */}
      <div className={activeAddress ? "flex h-full w-full justify-end items-center pr-2" : "flex h-full w-full justify-center items-center"}>
        {activeAddress ? (
          isOnOwnProfilePage ? (
            // If on own profile page, show WalletButton (logged in, on profile)
            <WalletButton className="flex flex-col justify-center items-center text-muted-foreground hover:text-foreground rounded-none !bg-transparent !p-0 !shadow-none">
              <User className="h-5 w-5" />
              <span className="text-xs whitespace-nowrap">Wallet</span>
            </WalletButton>
          ) : (
            // Otherwise, show Profile button (logged in, not on profile)
            <Button variant="ghost" size="icon" onClick={handleProfileClick} className="flex flex-col justify-center items-center text-muted-foreground hover:text-foreground rounded-none">
              <User className="h-5 w-5" />
              <span className="text-xs">Profile</span>
            </Button>
          )
        ) : (
          // If no activeAddress, show Connect Wallet button (not logged in)
          <WalletButton className="flex flex-col justify-center items-center text-muted-foreground hover:text-foreground rounded-none !bg-transparent !p-0 !shadow-none">
            <User className="h-5 w-5" />
            <span className="text-xs whitespace-nowrap">Connect</span>
          </WalletButton>
        )}
      </div>
    </div>
  );
}