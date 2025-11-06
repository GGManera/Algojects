"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback, useImperativeHandle } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { Footer } from '@/components/Footer';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';

interface NewWebsiteProps {
  scrollToTopTrigger?: number;
}

export interface NewWebsiteRef {
  scrollToActiveSlideTop: () => void;
  resetAllScrolls: () => void;
}

const LAST_ACTIVE_ID_KEY = 'algojects_last_active_id';

const NewWebsite = React.forwardRef<NewWebsiteRef, NewWebsiteProps>(({ scrollToTopTrigger }, ref) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { pushEntry, lastProjectPath, lastProfilePath, profile1, profile2, currentProfileSlot } = useNavigationHistory();
  const { activeAddress } = useWallet();
  const { projectDetails, loading: projectDetailsLoading } = useProjectDetails(); // NEW: Use loading from useProjectDetails
  const { isMobile, isDeviceLandscape } = useAppContextDisplayMode();
  
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isKeyboardModeActive, setIsKeyboardModeActive] = useState(false);
  
  const [hashToScroll, setHashToScroll] = useState<string | null>(null);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [lastScrolledHash, setLastScrolledHash] = useState<string | null>(null);
  
  // NEW: State to trigger scroll to top from HeroSection/Logo click
  const [internalScrollToTopTrigger, setInternalScrollToTopTrigger] = useState(0);

  const slideRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // NEW: Refs and constants for touchpad navigation
  const lastSwipeTimeRef = useRef(0);
  const SWIPE_DEBOUNCE_MS = 500;
  const SWIPE_THRESHOLD = 50;

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

  const effectiveProjectId = projectIdFromUrl || lastProjectPath?.path.split('/')[2];
  const effectiveProfileAddress = addressFromUrl || lastProfilePath?.path.split('/')[2] || activeAddress;

  const { nfd: effectiveProfileNfd, loading: nfdLoading } = useNfd(effectiveProfileAddress);

  const handleKeyboardModeChange = useCallback((isActive: boolean) => {
    setIsKeyboardModeActive(isActive);
  }, []);

  // NEW: Função para rolar o slide ativo para o topo (chamada pelo Layout/DynamicNavButtons)
  const scrollToActiveSlideTop = useCallback(() => {
    if (!api) return;
    const activeSlideType = slidesConfig[api.selectedScrollSnap()]?.type;
    const activeRef = slideRefs.current.get(activeSlideType || 'home');
    
    if (activeRef) {
      console.log(`[NewWebsite] Scrolling active slide (${activeSlideType}) to top.`);
      activeRef.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      console.warn(`[NewWebsite] Could not find ref for active slide type: ${activeSlideType}`);
    }
  }, [api]);

  // NEW: Função para rolar TODOS os slides para o topo
  const resetAllScrolls = useCallback(() => {
    console.log("[NewWebsite] Resetting scroll position for all slides.");
    slideRefs.current.forEach(ref => {
      if (ref) {
        ref.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    // Also reset the internal scroll trigger for the active slide components
    setInternalScrollToTopTrigger(prev => prev + 1);
  }, []);

  // NEW: Função para ser passada para HeroSection para scrollar o slide ativo
  const handleHeroScrollToTop = useCallback(() => {
    scrollToActiveSlideTop();
  }, [scrollToActiveSlideTop]);

  useImperativeHandle(ref, () => ({
    scrollToActiveSlideTop,
    resetAllScrolls,
  }));

  const slidesConfig = useMemo(() => {
    const config = [];
    config.push({ 
      type: 'home', 
      pathPrefix: '/', 
      component: <Projects 
        isInsideCarousel={true} 
        scrollToTopTrigger={internalScrollToTopTrigger} 
        onKeyboardModeChange={handleKeyboardModeChange} 
        onScrollToTop={handleHeroScrollToTop} // Pass the scroll function
      />, 
      maxWidth: 'max-w-[710px]' 
    });
    
    if (effectiveProjectId) {
      config.push({ 
        type: 'project', 
        pathPrefix: '/project/', 
        component: <ProjectPage 
          projectId={effectiveProjectId} 
          isInsideCarousel={true} 
          hashToScroll={hashToScroll} 
          scrollTrigger={scrollTrigger} 
          scrollToTopTrigger={internalScrollToTopTrigger} 
          onKeyboardModeChange={handleKeyboardModeChange} 
          onScrollToTop={handleHeroScrollToTop} // Pass the scroll function
        />, 
        maxWidth: 'max-w-[710px]' 
      });
    }

    if (effectiveProfileAddress) {
      config.push({ 
        type: 'profile', 
        pathPrefix: '/profile/', 
        component: <UserProfile 
          address={effectiveProfileAddress} 
          isInsideCarousel={true} 
          scrollToTopTrigger={internalScrollToTopTrigger} 
          onKeyboardModeChange={handleKeyboardModeChange} 
        />, 
        maxWidth: 'max-w-[710px]' 
      });
    }
    return config;
  }, [effectiveProjectId, effectiveProfileAddress, hashToScroll, scrollTrigger, internalScrollToTopTrigger, handleKeyboardModeChange, handleHeroScrollToTop]);

  const targetSlideIndex = useMemo(() => {
    const currentPath = location.pathname;
    let targetType: 'home' | 'project' | 'profile' = 'home';

    if (currentPath.startsWith('/project/')) {
      targetType = 'project';
    } else if (currentPath.startsWith('/profile/')) {
      targetType = 'profile';
    }

    const index = slidesConfig.findIndex(slide => slide.type === targetType);
    return index !== -1 ? index : 0;
  }, [location.pathname, slidesConfig]);

  useEffect(() => {
    if (!api) return;

    const handleSelect = () => {
      const newIndex = api.selectedScrollSnap();
      setCurrentSlideIndex(newIndex);

      const selectedSlide = slidesConfig[newIndex];

      let newPath = location.pathname;

      if (selectedSlide) {
        if (selectedSlide.type === 'home') {
          newPath = '/';
        } else if (selectedSlide.type === 'project') {
          if (effectiveProjectId) {
            newPath = `/project/${effectiveProjectId}`;
          } else {
            newPath = '/';
          }
        } else if (selectedSlide.type === 'profile') {
          if (effectiveProfileAddress) {
            newPath = `/profile/${effectiveProfileAddress}`;
          } else {
            newPath = '/';
          }
        }
      } else {
        newPath = '/';
      }

      if (newPath !== location.pathname) {
        navigate(newPath);
      }
    };

    const handleSettle = () => {
      const settledIndex = api.selectedScrollSnap();
      const settledSlide = slidesConfig[settledIndex];
      if (settledSlide?.type === 'project' && location.pathname.startsWith('/project/')) {
        setScrollTrigger(prev => prev + 1);
      }
      setIsTransitioning(false);
    };

    const handleScroll = () => {
      if (api.scrollProgress() > 0.001 && api.scrollProgress() < 0.999) {
        setIsTransitioning(true);
      }
    };

    api.on("select", handleSelect);
    api.on("settle", handleSettle);
    api.on("scroll", handleScroll);

    setHashToScroll(location.hash);

    if (location.pathname.startsWith('/project/') && !effectiveProjectId) {
      navigate('/');
      return;
    }
    if (location.pathname.startsWith('/profile/') && !effectiveProfileAddress) {
      navigate('/');
      return;
    }

    if (api.selectedScrollSnap() !== targetSlideIndex) {
      api.scrollTo(targetSlideIndex);
    } else if (targetSlideIndex === 1 && location.pathname.startsWith('/project/') && location.hash) {
      if (location.hash !== lastScrolledHash) {
        setScrollTrigger(prev => prev + 1);
        setLastScrolledHash(location.hash);
      }
    }

    return () => {
      api.off("select", handleSelect);
      api.off("settle", handleSettle);
      api.off("scroll", handleScroll);
    };
  }, [
    api,
    targetSlideIndex,
    location.pathname,
    location.hash,
    effectiveProjectId,
    effectiveProfileAddress,
    navigate,
    slidesConfig,
    lastProjectPath,
    lastProfilePath,
    activeAddress,
    projectIdFromUrl,
    addressFromUrl,
    lastScrolledHash
  ]);

  useEffect(() => {
    if (isTransitioning) {
      if (isKeyboardModeActive) {
        document.body.style.cursor = 'none';
      } else {
        document.body.style.cursor = 'default';
      }
    } else {
      if (isKeyboardModeActive) {
        document.body.style.cursor = 'none';
      } else {
        document.body.style.cursor = 'default';
      }
    }
  }, [isTransitioning, isKeyboardModeActive]);

  useEffect(() => {
    const path = location.pathname;
    let label = "Projects";

    if (path.startsWith('/project/')) {
      const currentProjectId = path.split('/')[2];
      // NEW: Check if projectDetails is loading before trying to find project name
      if (!projectDetailsLoading) {
        const project = projectDetails.find(pd => pd.projectId === currentProjectId);
        label = project?.projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${currentProjectId}`;
      } else {
        label = `Project ${currentProjectId}`; // Fallback while loading
      }
    } else if (path.startsWith('/profile/')) {
      const currentProfileAddress = path.split('/')[2];
      label = effectiveProfileNfd?.name || `${currentProfileAddress.substring(0, 8)}... Profile`;
    }

    if (!path.startsWith('/profile/') || !nfdLoading) {
      pushEntry({ path, label, activeCategory: undefined });
    }
  }, [location.pathname, projectDetails, pushEntry, effectiveProfileNfd, nfdLoading, projectDetailsLoading]); // NEW: Add projectDetailsLoading dependency

  useEffect(() => {
    if (!api || isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTagName = (e.target as HTMLElement).tagName;
      if (targetTagName === 'INPUT' || targetTagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      const isRightKey = ['arrowright', 'd'].includes(key);
      const isLeftKey = ['arrowleft', 'a'].includes(key);

      if (!isRightKey && !isLeftKey) return;
      
      if (isTransitioning) {
          e.preventDefault();
          return;
      }

      const currentSlideType = slidesConfig[api.selectedScrollSnap()]?.type;

      // 1. Handle navigation from Project Page back to Home (A/ArrowLeft)
      if (currentSlideType === 'project' && isLeftKey && effectiveProjectId) {
        e.preventDefault();
        try {
          localStorage.setItem(LAST_ACTIVE_ID_KEY, JSON.stringify({ id: effectiveProjectId, path: '/' }));
        } catch (error) {
          console.error("Failed to cache project ID for home page focus:", error);
        }
        navigate('/');
        return;
      }

      // 2. Handle navigation from Home to Project Page (D/ArrowRight)
      if (currentSlideType === 'home' && isRightKey) {
        const focusedElement = document.querySelector('#projects-home [data-nav-id].focus-glow-border');
        if (focusedElement) {
          const focusedProjectId = focusedElement.getAttribute('data-nav-id');
          if (focusedProjectId) {
            e.preventDefault();
            navigate(`/project/${focusedProjectId}`, { state: { scrollToTop: true } });
            return;
          }
        }
      }
      
      // 3. Default Carousel Navigation (A/D)
      if (isRightKey) {
        api.scrollNext();
      } else if (isLeftKey) {
        api.scrollPrev();
      }
    };

    // NEW: Handle touchpad horizontal scroll/swipe
    const handleWheel = (e: WheelEvent) => {
      // Only intercept if there is significant horizontal movement AND it dominates vertical movement
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > SWIPE_THRESHOLD) {
        
        // Prevent default browser navigation/scroll
        e.preventDefault(); 
        
        if (isTransitioning) {
          return;
        }

        const now = Date.now();
        if (now - lastSwipeTimeRef.current < SWIPE_DEBOUNCE_MS) {
          return;
        }

        lastSwipeTimeRef.current = now;

        if (e.deltaX > 0) {
          // Swiping left (deltaX positive) -> Go to next slide (right)
          api.scrollNext();
        } else {
          // Swiping right (deltaX negative) -> Go to previous slide (left)
          api.scrollPrev();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [api, isMobile, navigate, effectiveProjectId, slidesConfig, location.pathname, isTransitioning]);

  const cardContentMaxHeightClass = useMemo(() => {
    // Desktop/Landscape: Fixed top elements: StickyHeader (48px) + dynamic-nav-buttons-desktop-vertical-gap (12px) + DynamicNavButtons (32px) = 92px.
    // Mobile Portrait: Fixed top elements: StickyHeader (48px). Fixed bottom elements: MobileBottomBar (64px) + DynamicNavButtons (32px) = 96px.
    if (isMobile && isDeviceLandscape) {
      return "max-h-[calc(100vh - var(--total-fixed-top-height-desktop) - env(safe-area-inset-top) - env(safe-area-inset-bottom))]";
    } else if (isMobile && !isDeviceLandscape) {
      // Corrected calculation for mobile portrait:
      // 100vh - StickyHeader - DynamicNavButtons - MobileBottomBar - safe-area-insets
      return "max-h-[calc(100vh - var(--sticky-header-height) - var(--dynamic-nav-buttons-height) - var(--mobile-bottom-bar-height) - env(safe-area-inset-top) - env(safe-area-inset-bottom))]";
    } else {
      return "max-h-[calc(100vh - var(--total-fixed-top-height-desktop) - env(safe-area-inset-top) - env(safe-area-inset-bottom))]";
    }
  }, [isMobile, isDeviceLandscape]);

  return (
    <div className="w-full px-0 py-0 md:p-0 text-foreground h-full scroll-mt-header-offset">
      <Carousel setApi={setApi} className="w-full" opts={{ duration: 13, baseFriction: 0.5 }}>
        <CarouselContent>
          {slidesConfig.map((slide, index) => {
            const slideComponent = React.cloneElement(slide.component, {
              isActive: index === currentSlideIndex,
              onScrollToTop: handleHeroScrollToTop, // Pass the scroll function to HeroSection
            });

            return (
              <CarouselItem 
                key={slide.type} 
                className={cn(
                  "h-full",
                  index === currentSlideIndex && "carousel-item-active"
                )}
              >
                <Card className={cn(
                  "p-0 bg-card",
                  "rounded-none border-none"
                )}>              
                  <CardContent
                    ref={el => slideRefs.current.set(slide.type, el)}
                    className={cn(
                      "overflow-y-auto scrollbar-thin",
                      cardContentMaxHeightClass
                    )}
                  >
                    <div className={cn("w-full mx-auto", slide.maxWidth)}>
                      {slideComponent}
                      <Footer /> {/* Removed isMobile prop */}
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
    </div>
  );
});

NewWebsite.displayName = 'NewWebsite';

export default NewWebsite;