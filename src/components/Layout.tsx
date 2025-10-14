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

  const newWebsiteRef = useRef<NewWebsiteRef>(null); // NEW: Ref para o componente NewWebsite

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

  // NEW: Função para rolar o slide ativo para o topo
  const handleCenterButtonClick = useCallback(() => {
    if (newWebsiteRef.current) {
      newWebsiteRef.current.scrollToActiveSlideTop();
    }
  }, []);

  // Calcula o preenchimento superior para o main
  let mainTopPadding = "pt-[calc(var(--sticky-header-height)+env(safe-area-inset-top))]";
  if (!isMobile || isDeviceLandscape) {
    mainTopPadding = "pt-[calc(var(--sticky-header-height)+var(--dynamic-nav-buttons-height)+var(--dynamic-nav-buttons-desktop-vertical-gap)+env(safe-area-inset-top))]";
  }

  // Calcula o preenchimento inferior para o main (apenas se for mobile E portrait)
  let mainBottomPadding = "";
  if (isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape) {
    mainBottomPadding = "pb-[calc(var(--mobile-bottom-bar-height)+var(--dynamic-nav-buttons-height)+env(safe-area-inset-bottom))]";
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <StickyHeader />
      <DynamicNavButtons onCenterButtonClick={handleCenterButtonClick} />
      <main
        className={cn(
          "flex-grow relative overflow-hidden",
          mainTopPadding,
          mainBottomPadding
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