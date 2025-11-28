"use client";

import { WalletButton } from '@txnlab/use-wallet-ui-react';
import { useLocation } from 'react-router-dom';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { cn } from '@/lib/utils';
import { useWallet } from '@txnlab/use-wallet-react';
import { MobileBottomBar } from './MobileBottomBar';
import { useSocialData } from '@/hooks/useSocialData';
import React, { useCallback, useState, useRef } from 'react';
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
  
  const isMobilePortrait = isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape; // NEW: Define mobile portrait mode

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

  // REMOVED: mainTopPadding and mainBottomPadding calculation.
  // The main element will now take up the full viewport height (min-h-screen)
  // and the content inside NewWebsite will handle the offsets.

  return (
    <div className="relative min-h-screen flex flex-col">
      {!isMobilePortrait && <StickyHeader onLogoClick={handleLogoClickAndReset} />}
      {/* DynamicNavButtons is now an immediate child of the Layout div */}
      <DynamicNavButtons onCenterButtonClick={handleCenterButtonClick} />
      <main
        className={cn(
          "flex-grow relative overflow-hidden h-screen", // Set h-screen to ensure it fills the viewport
        )}
      >
        {/* Passando a ref para o NewWebsite */}
        {React.cloneElement(children as React.ReactElement, { ref: newWebsiteRef })}
      </main>
      {isMobilePortrait && (
        <MobileBottomBar
          projects={projects}
          onInteractionSuccess={handleGlobalRefresh}
        />
      )}
    </div>
  );
};

export default Layout;