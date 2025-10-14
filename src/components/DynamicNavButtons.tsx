"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Repeat2 } from 'lucide-react';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { cn } from '@/lib/utils';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';

// A prop onCenterButtonClick foi reintroduzida para delegar a ação de rolagem.
export function DynamicNavButtons({ onCenterButtonClick }: { onCenterButtonClick: () => void }) {
  const location = useLocation();
  const { isMobile, appDisplayMode, isDeviceLandscape } = useAppContextDisplayMode();
  const {
    lastProjectPath,
    lastProfilePath,
    profile1,
    profile2,
    currentProfileSlot,
    historyStack,
  } = useNavigationHistory();

  // O handler agora simplesmente chama a função recebida via props.
  const handleCenterButtonClick = () => {
    if (onCenterButtonClick) {
      onCenterButtonClick();
    }
  };

  // Determina se a página atual é uma página de perfil
  const isProfilePage = location.pathname.startsWith('/profile/');
  const isProjectPage = location.pathname.startsWith('/project/');
  const isHomePage = location.pathname === '/';

  // --- Lógica do Botão Esquerdo ---
  let leftButton: { label: string; path: string } | null = null;

  if (isProjectPage) {
    leftButton = { label: 'All Projects', path: '/' };
  } else if (isProfilePage) {
    if (lastProjectPath) {
      leftButton = { label: lastProjectPath.label, path: lastProjectPath.path };
    } else {
      leftButton = { label: 'All Projects', path: '/' };
    }
  } else if (isHomePage) {
    leftButton = null;
  }

  // --- Lógica do Botão Direito ---
  let rightButton: { label: string; path: string; action?: 'switchProfile'; state?: { initialActiveCategory: 'writing' | 'curating' } } | null = null;

  if (isProjectPage) {
    if (lastProfilePath) {
      rightButton = { label: 'Profile', path: lastProfilePath.path };
      if (lastProfilePath.activeCategory) {
        rightButton.state = { initialActiveCategory: lastProfilePath.activeCategory };
      }
    }
  } else if (isProfilePage) {
    const currentProfileAddress = location.pathname.split('/')[2];
    const otherProfile = (currentProfileSlot === 1 && profile2 && profile2.address !== currentProfileAddress)
      ? profile2
      : (currentProfileSlot === 2 && profile1 && profile1.address !== currentProfileAddress)
        ? profile1
        : null;

    if (otherProfile) {
      rightButton = { label: 'Switch Profile', path: `/profile/${otherProfile.address}`, action: 'switchProfile' };
      const currentProfileEntry = historyStack.find(entry => entry.path === location.pathname);
      if (currentProfileEntry?.activeCategory) {
        rightButton.state = { initialActiveCategory: currentProfileEntry.activeCategory };
      }
    }
  } else if (isHomePage) {
    if (lastProjectPath) {
      rightButton = { label: 'Project', path: lastProjectPath.path };
    } else {
      rightButton = null;
    }
  }

  // --- Lógica de Exibição do Nome do Slide Atual ---
  let currentSlideName = "Home";
  if (isProjectPage) {
    currentSlideName = "Project";
  } else if (isProfilePage) {
    currentSlideName = "Profile";
  }

  return (
    <div className={cn(
      "fixed left-0 right-0 z-30 w-full bg-hodl-darker",
      (isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape)
        ? "bottom-[var(--mobile-bottom-bar-height)] border-t border-border-accent-green top-border-glow"
        : "top-[calc(var(--sticky-header-height)+var(--dynamic-nav-buttons-desktop-vertical-gap))] border-b border-border-accent-green bottom-border-glow h-[var(--dynamic-nav-buttons-height)]"
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

        <div className="absolute left-1/2 -translate-x-1/2 flex justify-center z-10">
          <div 
            className={cn(
              "btn-profile !h-[21.6px] !px-[5.4px] !py-[0.9px] !w-auto !min-w-[72px] !max-w-[108px]",
              isMobile && "!h-[19.44px] !px-[4.86px] !py-[0.81px] !min-w-[64.8px] !max-w-[97.2px]"
            )}
            onClick={handleCenterButtonClick}
          >
            <strong className={cn(
              "uppercase text-[7.2px]",
              isMobile && "text-[6.48px]"
            )}>{currentSlideName}</strong>
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