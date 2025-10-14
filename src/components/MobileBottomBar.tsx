"use client";

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
    if (location.pathname === '/') {
      // If already on the home page, dispatch a custom event to signal a reset.
      // The parent component should listen for this to reset slides and scroll.
      window.dispatchEvent(new CustomEvent('resetHomePage'));
    } else {
      // Otherwise, navigate to the home page.
      navigate('/');
    }
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

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-hodl-darker border-t border-border-accent-green z-50 h-16 flex items-center justify-around md:hidden">
      <Button variant="ghost" size="icon" onClick={handleHomeClick} className="flex flex-col h-full w-full justify-center items-center text-muted-foreground hover:text-foreground rounded-none">
        <Home className="h-5 w-5" />
        <span className="text-xs -mt-[7px] -ml-[1px]">Home</span>
      </Button>

      {activeAddress && ( // Conditionally render the AddActionSheet
        <AddActionSheet projects={projects} onInteractionSuccess={onInteractionSuccess}>
          <Button variant="ghost" size="icon" className="flex flex-col h-full w-full justify-center items-center text-muted-foreground hover:text-foreground rounded-none">
            <Plus className="h-5 w-5" />
            <span className="text-xs -mt-[7px] -ml-[1px]">Add</span>
          </Button>
        </AddActionSheet>
      )}

      {activeAddress ? (
        <Button variant="ghost" size="icon" onClick={handleProfileClick} className="flex flex-col h-full w-full justify-center items-center text-muted-foreground hover:text-foreground rounded-none">
          <User className="h-5 w-5" />
          <span className="text-xs -mt-[7px] -ml-[1px]">Profile</span>
        </Button>
      ) : (
        <WalletButton className="flex flex-col h-full w-full justify-center items-center text-muted-foreground hover:text-foreground rounded-none !bg-transparent !p-0 !shadow-none">
          <User className="h-5 w-5" />
          <span className="text-xs -mt-[7px] -ml-[1px] whitespace-nowrap">Connect</span>
        </WalletButton>
      )}
    </div>
  );
}