"use client";

import { WalletButton } from '@txnlab/use-wallet-ui-react';
import { useLocation, useNavigate } from 'react-router-dom'; // Import useNavigate
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
import NewWebsite, { NewWebsiteRef } from '@/pages/NewWebsite';
import { useTransactionDraft, TransactionDraft } from '@/hooks/useTransactionDraft'; // NEW
import { TransactionRecoveryAlert } from './TransactionRecoveryAlert'; // NEW

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { isMobile, appDisplayMode, isDeviceLandscape } = useAppContextDisplayMode();
  const { activeAddress } = useWallet();
  const { projects, refetch: refetchSocialData, isRefreshing: isRefreshingSocialData } = useSocialData();
  const { refetch: refetchProjectDetails, isRefreshing: isRefreshingProjectDetails } = useProjectDetails();
  const { refetch: refetchAccountData, loading: accountDataLoading } = useAccountData(activeAddress);
  const location = useLocation();
  const navigate = useNavigate(); // Use useNavigate hook
  
  const { draft, clearDraft } = useTransactionDraft(); // NEW

  const newWebsiteRef = useRef<NewWebsiteRef>(null);

  const isOverallRefreshing = isRefreshingSocialData || isRefreshingProjectDetails || accountDataLoading;
  
  const isMobilePortrait = isMobile && appDisplayMode === 'portrait' && !isDeviceLandscape;

  const handleGlobalRefresh = useCallback(async () => {
    console.log("Triggering global data refresh...");
    await Promise.all([
      refetchSocialData(),
      refetchProjectDetails(),
      refetchAccountData(),
    ]);
    console.log("Global data refresh initiated.");
  }, [refetchSocialData, refetchProjectDetails, refetchAccountData]);

  const handleCenterButtonClick = useCallback(() => {
    if (newWebsiteRef.current) {
      newWebsiteRef.current.scrollToActiveSlideTop();
    }
  }, []);

  const handleLogoClickAndReset = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (newWebsiteRef.current) {
      newWebsiteRef.current.resetAllScrolls();
    }
    if (location.pathname !== '/') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [location.pathname]);
  
  // NEW: Handle draft recovery when wallet connects
  const handleResumeDraft = useCallback((draftToResume: TransactionDraft) => {
    // 1. Determine the target path
    let targetPath = '/';
    if (draftToResume.type === 'project') {
        targetPath = '/'; // New projects are created from the home page
    } else if (draftToResume.type === 'review' || draftToResume.type === 'metadata-suggestion') {
        targetPath = `/project/${draftToResume.projectId}`;
    } else if (draftToResume.type === 'comment' || draftToResume.type === 'reply') {
        // Navigate to project page and rely on the component to scroll/open the form
        targetPath = `/project/${draftToResume.projectId}#review-${draftToResume.parentReviewId}`;
    }
    
    // 2. Navigate and pass state to trigger form restoration
    // We use replace: true to prevent the recovery navigation from cluttering history
    navigate(targetPath, { state: { resumeDraft: true }, replace: true });
    // Note: We do NOT clear the draft here. The target form/page will clear it upon successful restoration.
  }, [navigate]);


  let mainTopMargin = "mt-0";
  if (!isMobile || isDeviceLandscape) {
    mainTopMargin = "mt-[calc(var(--total-fixed-top-height-desktop)+env(safe-area-inset-top))]";
  } else if (isMobilePortrait) {
    mainTopMargin = "mt-[env(safe-area-inset-top)]";
  }

  let mainBottomPadding = "";
  if (isMobilePortrait) {
    mainBottomPadding = "pb-[calc(var(--total-fixed-bottom-height-mobile)+env(safe-area-inset-bottom))]";
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {!isMobilePortrait && <StickyHeader onLogoClick={handleLogoClickAndReset} />}
      <DynamicNavButtons onCenterButtonClick={handleCenterButtonClick} />
      <main
        className={cn(
          "flex-grow relative overflow-hidden",
          mainTopMargin,
          mainBottomPadding
        )}
      >
        {React.cloneElement(children as React.ReactElement, { ref: newWebsiteRef })}
      </main>
      {isMobilePortrait && (
        <MobileBottomBar
          projects={projects}
          onInteractionSuccess={handleGlobalRefresh}
        />
      )}
      {/* NEW: Transaction Recovery Alert */}
      {draft && (
        <TransactionRecoveryAlert 
          draft={draft} 
          onResume={handleResumeDraft} 
          onDiscard={clearDraft} 
        />
      )}
    </div>
  );
};

export default Layout;