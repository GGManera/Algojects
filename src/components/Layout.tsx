"use client";

import { WalletButton } from '@txnlab/use-wallet-ui-react';
import { useLocation } from 'react-router-dom';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { cn } from '@/lib/utils';
import { SettingsDialog } from './SettingsDialog';
import { ProfileButton } from './ProfileButton';
import { useWallet } from '@txnlab/use-wallet-react';
import { MobileBottomBar } from './MobileBottomBar';
import { useSocialData } from '@/hooks/useSocialData';
import React, { useCallback, useState } from 'react';
import { StickyHeader } from './StickyHeader';
import { useHeroLogoVisibility } from '@/contexts/HeroLogoVisibilityContext';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { useNfd } from '@/hooks/useNfd';
import { DynamicNavButtons } from './DynamicNavButtons';
import { useAccountData } from '@/hooks/useAccountData';


const Layout = ({ children }: { children: React.ReactNode }) => {
  const { isMobile, appDisplayMode, isDeviceLandscape } = useAppContextDisplayMode();
  const { activeAddress } = useWallet();
  const { projects, loading: socialDataLoading, error: socialDataError, refetch: refetchSocialData, isRefreshing: isRefreshingSocialData } = useSocialData();
  const { projectDetails, loading: projectDetailsLoading, error: projectDetailsError, refetch: refetchProjectDetails, isRefreshing: isRefreshingProjectDetails } = useProjectDetails();
  const { refetch: refetchAccountData, loading: accountDataLoading } = useAccountData(activeAddress);
  const { nfd: activeUserNfd } = useNfd(activeAddress);
  const location = useLocation();

  // NEW: State to hold the scroll function provided by the child (NewWebsite)
  const [scrollActiveSlideToTop, setScrollActiveSlideToTop] = useState<(() => void) | null>(null);

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

  // NEW: Function to be passed to DynamicNavButtons
  const handleCenterButtonClick = useCallback(() => {
    if (scrollActiveSlideToTop) {
      scrollActiveSlideToTop();
    }
  }, [scrollActiveSlideToTop]);

  // Calcula o preenchimento superior para o main
  let mainTopPadding = "pt-[calc(var(--sticky-header-height)+env(safe-area-inset-top))]";
  if (!isMobile || isDeviceLandscape) { // Apply desktop padding if not mobile OR if mobile in landscape
    // Desktop/Landscape: StickyHeader + DynamicNavButtons + 1*gap
    mainTopPadding = "pt-[calc(var(--sticky-header-height)+var(--dynamic-nav-buttons-height)+var(--dynamic-nav-buttons-desktop-vertical-gap)+env(safe-area-inset-top))]";
  }

  // Calcula o preenchimento inferior para o main (apenas se for mobile E portrait)
  let mainBottomPadding = "";
  if (isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape) { // Only apply if mobile, portrait, and NOT landscape
    // Mobile: MobileBottomBar + DynamicNavButtons
    mainBottomPadding = "pb-[calc(var(--mobile-bottom-bar-height)+var(--dynamic-nav-buttons-height)+env(safe-area-inset-bottom))]";
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <StickyHeader />
      <DynamicNavButtons onCenterButtonClick={handleCenterButtonClick} /> {/* Pass the new handler */}
      <main
        className={cn(
          "flex-grow relative overflow-hidden",
          mainTopPadding,
          mainBottomPadding
        )}
      >
        {/* Pass the setter function to the child (NewWebsite) */}
        {React.cloneElement(children as React.ReactElement, { onCenterButtonClick: setScrollActiveSlideToTop })}
      </main>
      {isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape && ( // Only render MobileBottomBar if mobile, portrait, and NOT landscape
        <MobileBottomBar
          projects={projects}
          onInteractionSuccess={handleGlobalRefresh}
        />
      )}
    </div>
  );
};

export default Layout;