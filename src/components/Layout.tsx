"use client";

import { WalletButton } from '@txnlab/use-wallet-ui-react';
import { useLocation } from 'react-router-dom';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { cn } from '@/lib/utils';
import { useWallet } from '@txnlab/use-wallet-react';
import { MobileBottomBar } from './MobileBottomBar';
import { useSocialData } from '@/hooks/useSocialData';
import React, { useCallback, useState, useRef, useMemo } from 'react'; // Import useMemo
import { StickyHeader } from './StickyHeader';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { useAccountData } from '@/hooks/useAccountData';
import { DynamicNavButtons } from './DynamicNavButtons';
import NewWebsite, { NewWebsiteRef } from '@/pages/NewWebsite'; // Importando NewWebsite e seu tipo de ref

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { isMobile, appDisplayMode, isDeviceLandscape } = useAppContextDisplayMode();
  const { activeAddress } = useWallet();
  const { projects, refetch: refetchSocialData, isRefreshing: isRefreshingSocialData } = useSocialData();
  const { refetch: refetchProjectDetails, isRefreshing: isRefreshingProjectDetails } = useProjectDetails();
  const { refetch: refetchAccountData, loading: accountDataLoading } = useAccountData(activeAddress);
  const location = useLocation();

  const newWebsiteRef = useRef<NewWebsiteRef>(null); // Ref para o componente NewWebsite

  const isOverallRefreshing = isRefreshingSocialData || isRefreshingProjectDetails || accountDataLoading;

  const handleGlobalRefresh = useCallback(async () => {
    console.log("Triggering global data refresh...");
    await Promise.all([
      refetchSocialData(),
      refetchProjectDetails(),
      refetchAccountData(),
    ]);
    console.log("Global data refresh initiated.");
  }, [refetchSocialData, refetchProjectDetails, refetchAccountData]);

  // Função para rolar o slide ativo para o topo (chamada pelo DynamicNavButtons)
  const handleCenterButtonClick = useCallback(() => {
    if (newWebsiteRef.current) {
      newWebsiteRef.current.scrollToActiveSlideTop();
    }
  }, []);

  // NEW: Função para resetar a rolagem de TODOS os slides (chamada pelo StickyHeader)
  const handleLogoClickAndReset = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (newWebsiteRef.current) {
      newWebsiteRef.current.resetAllScrolls();
    }
    // Navegar para a home (slide 1)
    if (location.pathname !== '/') {
      window.history.pushState({}, '', '/');
      // Forçar o re-render e a navegação do router
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [location.pathname]);

  // Calcula a altura do conteúdo principal
  const mainContentHeightClass = useMemo(() => {
    if (isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape) {
      // Mobile Portrait: 100vh - StickyHeader - DynamicNavButtons - MobileBottomBar - safe-area-insets
      return "h-[calc(100vh - var(--sticky-header-height) - var(--dynamic-nav-buttons-height) - var(--mobile-bottom-bar-height) - env(safe-area-inset-top) - env(safe-area-inset-bottom))]";
    } else {
      // Desktop/Landscape: 100vh - StickyHeader - DynamicNavButtons - Gap - safe-area-insets
      return "h-[calc(100vh - var(--total-fixed-top-height-desktop) - env(safe-area-inset-top) - env(safe-area-inset-bottom))]";
    }
  }, [isMobile, appDisplayMode, isDeviceLandscape]);

  return (
    <div className="relative min-h-screen flex flex-col">
      <StickyHeader onLogoClick={handleLogoClickAndReset} />
      <DynamicNavButtons onCenterButtonClick={handleCenterButtonClick} />
      <main
        className={cn(
          "flex-grow relative overflow-hidden",
          mainContentHeightClass // ADD new height class
        )}
      >
        {/* Passando a ref para o NewWebsite */}
        {React.cloneElement(children as React.ReactElement, { ref: newWebsiteRef })}
      </main>
      {isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape && (
        <MobileBottomBar
          projects={projects}
          onInteractionSuccess={handleGlobalRefresh}
        />
      )}
    </div>
  );
};

export default Layout;