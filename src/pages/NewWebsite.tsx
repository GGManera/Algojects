"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card"; // Import Card
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Repeat2 } from "lucide-react";
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import Projects from '@/pages/Projects';
import ProjectPage from '@/pages/ProjectPage';
import UserProfile from '@/pages/UserProfile';
import { useWallet } from '@txnlab/use-wallet-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { useNfd } from '@/hooks/useNfd';
import { Footer } from '@/components/Footer'; // RE-ADDED: Footer is now rendered inside each CarouselItem
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';

interface NewWebsiteProps {
  scrollToTopTrigger?: number; // NEW prop
}

const NewWebsite = ({ scrollToTopTrigger }: NewWebsiteProps) => { // Accept scrollToTopTrigger
  const location = useLocation();
  const navigate = useNavigate();
  const { pushEntry, lastProjectPath, lastProfilePath, profile1, profile2, currentProfileSlot } = useNavigationHistory();
  const { activeAddress } = useWallet();
  const { projectDetails } = useProjectDetails();
  const { isMobile, isDeviceLandscape } = useAppContextDisplayMode(); // NEW: isDeviceLandscape
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // New states for managing hash scrolling
  const [hashToScroll, setHashToScroll] = useState<string | null>(null);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [lastScrolledHash, setLastScrolledHash] = useState<string | null>(null); // NEW: Track the last hash that was scrolled to

  const { projectIdFromUrl, addressFromUrl } = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    let pId: string | undefined;
    let addr: string | undefined;

    if (pathParts[0] === 'project' && pathParts[1]) {
      pId = pathParts[1];
    } else if (pathParts[0] === 'profile' && pathParts[1]) {
      addr = pathParts[1];
    }

    return { projectIdFromUrl: pId, addressFromUrl: addr };
  }, [location.pathname]);

  // Determine the effective projectId to display in the ProjectPage card
  const effectiveProjectId = projectIdFromUrl || lastProjectPath?.path.split('/')[2];

  // Determine the effective profile address to display in the UserProfile card
  const effectiveProfileAddress = addressFromUrl || lastProfilePath?.path.split('/')[2] || activeAddress;

  // Use NFD hook for the effectiveProfileAddress to get its NFD name for history labels
  const { nfd: effectiveProfileNfd, loading: nfdLoading } = useNfd(effectiveProfileAddress);

  // Dynamically build the slides configuration based on available data
  const slidesConfig = useMemo(() => {
    const config = [];
    config.push({ type: 'home', pathPrefix: '/', component: <Projects isInsideCarousel={true} scrollToTopTrigger={scrollToTopTrigger} />, maxWidth: 'max-w-[788px]' }); // Pass scrollToTopTrigger

    if (effectiveProjectId) {
      config.push({ type: 'project', pathPrefix: '/project/', component: <ProjectPage projectId={effectiveProjectId} isInsideCarousel={true} hashToScroll={hashToScroll} scrollTrigger={scrollTrigger} scrollToTopTrigger={scrollToTopTrigger} />, maxWidth: 'max-w-[788px]' }); // Pass scrollToTopTrigger
    }

    if (effectiveProfileAddress) {
      config.push({ type: 'profile', pathPrefix: '/profile/', component: <UserProfile address={effectiveProfileAddress} isInsideCarousel={true} scrollToTopTrigger={scrollToTopTrigger} />, maxWidth: 'max-w-[788px]' }); // Pass scrollToTopTrigger
    }
    return config;
  }, [effectiveProjectId, effectiveProfileAddress, hashToScroll, scrollTrigger, scrollToTopTrigger]); // Add scrollToTopTrigger to dependencies

  // Determine the target slide index based on the current URL and rendered slides
  const targetSlideIndex = useMemo(() => {
    const currentPath = location.pathname;
    let targetType: 'home' | 'project' | 'profile' = 'home';

    if (currentPath.startsWith('/project/')) {
      targetType = 'project';
    } else if (currentPath.startsWith('/profile/')) {
      targetType = 'profile';
    }

    const index = slidesConfig.findIndex(slide => slide.type === targetType);
    return index !== -1 ? index : 0; // Default to home if the target slide type is not currently rendered
  }, [location.pathname, slidesConfig]);

  useEffect(() => {
    if (!api) return;

    console.log(`[NewWebsite useEffect] Current Path: ${location.pathname}, Current Hash: ${location.hash}`);
    console.log(`[NewWebsite useEffect] targetSlideIndex: ${targetSlideIndex}, api.selectedScrollSnap(): ${api.selectedScrollSnap()}`);
    console.log(`[NewWebsite useEffect] effectiveProjectId: ${effectiveProjectId}, effectiveProfileAddress: ${effectiveProfileAddress}`);
    console.log(`[NewWebsite useEffect] lastProjectPath: ${lastProjectPath?.path}, lastProfilePath: ${lastProfilePath?.path}`);
    console.log(`[NewWebsite useEffect] activeAddress: ${activeAddress}`);


    const handleSelect = () => {
      const newIndex = api.selectedScrollSnap();
      setCurrentSlideIndex(newIndex); // Update internal state

      const selectedSlide = slidesConfig[newIndex]; // Get the actual slide config for the new index

      let newPath = location.pathname; // Default to current path

      if (selectedSlide) {
        if (selectedSlide.type === 'home') {
          newPath = '/';
        } else if (selectedSlide.type === 'project') {
          // If we swiped to a project slide, ensure projectId is available
          if (effectiveProjectId) {
            newPath = `/project/${effectiveProjectId}`;
          } else {
            // This case should ideally not happen if slidesConfig is correctly built
            // but as a fallback, navigate to home
            newPath = '/';
          }
        } else if (selectedSlide.type === 'profile') {
          // If we swiped to a profile slide, ensure profileAddress is available
          if (effectiveProfileAddress) {
            newPath = `/profile/${effectiveProfileAddress}`;
          } else {
            // Fallback to home
            newPath = '/';
          }
        }
      } else {
        // Fallback if selectedSlide is somehow undefined (shouldn't happen with correct slidesConfig)
        newPath = '/';
      }

      console.log(`[handleSelect] Swiped to index: ${newIndex}, Proposed new path: ${newPath}, Current path: ${location.pathname}`);

      // Only navigate if the path is actually changing
      if (newPath !== location.pathname) {
        navigate(newPath);
      }
    };

    const handleSettle = () => {
      const settledIndex = api.selectedScrollSnap();
      const settledSlide = slidesConfig[settledIndex];
      console.log(`[handleSettle] Carousel settled on index: ${settledIndex}, type: ${settledSlide?.type}`);
      if (settledSlide?.type === 'project' && location.pathname.startsWith('/project/')) {
        // Carousel has settled on ProjectPage, now trigger hash scroll
        console.log(`[handleSettle] Triggering hash scroll for project page.`);
        setScrollTrigger(prev => prev + 1);
      }
    };

    api.on("select", handleSelect);
    api.on("settle", handleSettle); // Listen for settle event

    // Update hashToScroll whenever location.hash changes
    setHashToScroll(location.hash);

    // Handle redirection for "empty" project or profile pages if they are not rendered
    if (location.pathname.startsWith('/project/') && !effectiveProjectId) {
      console.log(`[NewWebsite useEffect] Redirecting from empty project path: ${location.pathname}`);
      navigate('/');
      return;
    }
    if (location.pathname.startsWith('/profile/') && !effectiveProfileAddress) {
      console.log(`[NewWebsite useEffect] Redirecting from empty profile path: ${location.pathname}`);
      navigate('/');
      return;
    }

    // Programmatically scroll carousel if the URL changes and it's not already on the correct slide
    if (api.selectedScrollSnap() !== targetSlideIndex) {
      console.log(`[NewWebsite useEffect] Scrolling carousel from ${api.selectedScrollSnap()} to ${targetSlideIndex}`);
      api.scrollTo(targetSlideIndex); // Removed 'true' to enable animation
    } else if (targetSlideIndex === 1 && location.pathname.startsWith('/project/') && location.hash) {
      // If already on the correct slide (ProjectPage) on initial load or direct URL access,
      // and there's a hash, trigger the scroll immediately, BUT ONLY IF IT'S A NEW HASH
      if (location.hash !== lastScrolledHash) { // <-- NEW CONDITION HERE
        console.log(`[NewWebsite useEffect] Already on project slide with NEW hash, triggering scroll.`);
        setScrollTrigger(prev => prev + 1);
        setLastScrolledHash(location.hash); // <-- UPDATE LAST SCROLLED HASH
      } else {
        console.log(`[NewWebsite useEffect] Already on project slide with SAME hash, skipping scroll trigger.`);
      }
    }

    return () => {
      api.off("select", handleSelect);
      api.off("settle", handleSettle);
    };
  }, [
    api,
    targetSlideIndex,
    location.pathname,
    location.hash, // This is a crucial dependency
    effectiveProjectId,
    effectiveProfileAddress,
    navigate,
    slidesConfig,
    lastProjectPath,
    lastProfilePath,
    activeAddress,
    projectIdFromUrl,
    addressFromUrl,
    lastScrolledHash // <-- ADD TO DEPENDENCY ARRAY
  ]);

  // useEffect to push entry to history when location.pathname changes
  useEffect(() => {
    const path = location.pathname;
    let label = "Projects"; // Default for home

    if (path.startsWith('/project/')) {
      const currentProjectId = path.split('/')[2];
      const project = projectDetails.find(pd => pd.projectId === currentProjectId);
      label = project?.projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${currentProjectId}`;
    } else if (path.startsWith('/profile/')) {
      const currentProfileAddress = path.split('/')[2];
      label = effectiveProfileNfd?.name || `${currentProfileAddress.substring(0, 8)}... Profile`;
    }

    // Only push if the label is resolved or if it's a non-profile page
    if (!path.startsWith('/profile/') || !nfdLoading) {
      pushEntry({ path, label, activeCategory: undefined }); // Push with current activeCategory
    }
  }, [location.pathname, projectDetails, pushEntry, effectiveProfileNfd, nfdLoading]);


  useEffect(() => {
    if (location.pathname === '/' && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname]);

  // Keyboard navigation effect
  useEffect(() => {
    if (!api || isMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const targetTagName = (event.target as HTMLElement).tagName;
      if (targetTagName === 'INPUT' || targetTagName === 'TEXTAREA') {
        return; // Do nothing if an input or textarea is focused
      }

      if (event.key === 'a' || event.key === 'ArrowLeft') {
        api.scrollPrev();
      } else if (event.key === 'd' || event.key === 'ArrowRight') {
        api.scrollNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [api, isMobile]);

  // Determine max-h for CardContent based on device and orientation
  const cardContentMaxHeightClass = useMemo(() => {
    if (isMobile && isDeviceLandscape) {
      // Mobile Landscape: StickyHeader + DynamicNavButtons + 1*gap
      return "max-h-[calc(100vh-var(--sticky-header-height)-var(--dynamic-nav-buttons-height)-var(--dynamic-nav-buttons-desktop-vertical-gap)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]";
    } else if (isMobile && !isDeviceLandscape) {
      // Mobile Portrait: StickyHeader + DynamicNavButtons + MobileBottomBar
      return "max-h-[calc(100vh-var(--sticky-header-height)-var(--dynamic-nav-buttons-height)-var(--mobile-bottom-bar-height)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]";
    } else {
      // Desktop: StickyHeader + DynamicNavButtons + 1*gap
      return "max-h-[calc(100vh-var(--sticky-header-height)-var(--dynamic-nav-buttons-height)-var(--dynamic-nav-buttons-desktop-vertical-gap)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]";
    }
  }, [isMobile, isDeviceLandscape]);

  return (
    <div ref={scrollRef} className="w-full px-0 py-0 md:p-0 text-foreground h-full scroll-mt-header-offset"> {/* Removed overflow-y-auto here */}
      <Carousel setApi={setApi} className="w-full" opts={{ duration: 20 }}>
        <CarouselContent>
          {slidesConfig.map((slide, index) => (
            <CarouselItem key={slide.type} className="h-full">
              <Card className={cn(
                "p-0 bg-card",
                "rounded-none border-none" // Always remove rounded corners and border
              )}>              
                <CardContent className={cn(
                  "overflow-y-auto scrollbar-thin",
                  cardContentMaxHeightClass // Apply dynamic max-h
                )}>
                  <div className={cn("w-full mx-auto", slide.maxWidth)}>
                    {slide.component}
                    <Footer isMobile={isMobile && !isDeviceLandscape} /> {/* RE-ADDED: Footer is now rendered inside each CarouselItem, but only if NOT landscape */}
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

export default NewWebsite;