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
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'; // Import useKeyboardNavigation

interface NewWebsiteProps {
  scrollToTopTrigger?: number;
}

// Definindo o tipo para a referência exposta
export interface NewWebsiteRef {
  scrollToActiveSlideTop: () => void;
  resetAllScrolls: () => void; // NEW: Função para resetar a rolagem de todos os slides
}

// Constante para a chave de cache do último item ativo (importada de useKeyboardNavigation)
const LAST_ACTIVE_ID_KEY = 'algojects_last_active_id';

const NewWebsite = React.forwardRef<NewWebsiteRef, NewWebsiteProps>(({ scrollToTopTrigger }, ref) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { pushEntry, lastProjectPath, lastProfilePath, profile1, profile2, currentProfileSlot } = useNavigationHistory();
  const { activeAddress } = useWallet();
  const { projectDetails } = useProjectDetails();
  const { isMobile, isDeviceLandscape } = useAppContextDisplayMode();
  
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  // New states for managing hash scrolling
  const [hashToScroll, setHashToScroll] = useState<string | null>(null);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [lastScrolledHash, setLastScrolledHash] = useState<string | null>(null);

  // NEW: State to track if navigation was initiated by keyboard
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);

  // NEW: Referências para os CardContents roláveis de cada slide
  const slideRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

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

  const slidesConfig = useMemo(() => {
    const config = [];
    config.push({ type: 'home', pathPrefix: '/', component: <Projects isInsideCarousel={true} scrollToTopTrigger={scrollToTopTrigger} />, maxWidth: 'max-w-[710px]' });
    
    if (effectiveProjectId) {
      config.push({ type: 'project', pathPrefix: '/project/', component: <ProjectPage projectId={effectiveProjectId} isInsideCarousel={true} hashToScroll={hashToScroll} scrollTrigger={scrollTrigger} scrollToTopTrigger={scrollToTopTrigger} />, maxWidth: 'max-w-[710px]' });
    }

    if (effectiveProfileAddress) {
      config.push({ type: 'profile', pathPrefix: '/profile/', component: <UserProfile address={effectiveProfileAddress} isInsideCarousel={true} scrollToTopTrigger={scrollToTopTrigger} />, maxWidth: 'max-w-[710px]' });
    }
    return config;
  }, [effectiveProjectId, effectiveProfileAddress, hashToScroll, scrollTrigger, scrollToTopTrigger]);

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

  // Função para rolar o slide ativo para o topo
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
  }, [api, slidesConfig]);

  // NEW: Função para rolar TODOS os slides para o topo
  const resetAllScrolls = useCallback(() => {
    console.log("[NewWebsite] Resetting scroll position for all slides.");
    slideRefs.current.forEach(ref => {
      if (ref) {
        ref.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }, []);

  // Expor as funções de rolagem para o componente pai (Layout)
  useImperativeHandle(ref, () => ({
    scrollToActiveSlideTop,
    resetAllScrolls, // Expor a nova função
  }));

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

      // Only navigate if the path is actually changing
      if (newPath !== location.pathname) {
        // Use the isKeyboardNavigating state to pass information via location state
        navigate(newPath, { state: { isKeyboardNav: isKeyboardNavigating } });
      }
      
      // Reset keyboard navigating state after navigation attempt
      setIsKeyboardNavigating(false);
    };

    const handleSettle = () => {
      const settledIndex = api.selectedScrollSnap();
      const settledSlide = slidesConfig[settledIndex];
      if (settledSlide?.type === 'project' && location.pathname.startsWith('/project/')) {
        setScrollTrigger(prev => prev + 1);
      }
    };

    api.on("select", handleSelect);
    api.on("settle", handleSettle);

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
    lastScrolledHash,
    isKeyboardNavigating // Added dependency
  ]);

  // Keyboard navigation effect
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

      const currentSlideType = slidesConfig[api.selectedScrollSnap()]?.type;

      // 1. Handle navigation from Project Page back to Home (A/ArrowLeft)
      if (currentSlideType === 'project' && isLeftKey && effectiveProjectId) {
        e.preventDefault();
        try {
          localStorage.setItem(LAST_ACTIVE_ID_KEY, JSON.stringify({ id: effectiveProjectId, path: '/' }));
        } catch (error) {
          console.error("Failed to cache project ID for home page focus:", error);
        }
        setIsKeyboardNavigating(true); // Set flag before navigation
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
            setIsKeyboardNavigating(true); // Set flag before navigation
            navigate(`/project/${focusedProjectId}`, { state: { scrollToTop: true, isKeyboardNav: true } });
            return;
          }
        }
      }
      
      // 3. Default Carousel Navigation (A/D)
      if (isRightKey) {
        setIsKeyboardNavigating(true); // Set flag before navigation
        api.scrollNext();
      } else if (isLeftKey) {
        setIsKeyboardNavigating(true); // Set flag before navigation
        api.scrollPrev();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [api, isMobile, navigate, effectiveProjectId, slidesConfig, location.pathname, effectiveProfileAddress]); // Added effectiveProfileAddress

  useEffect(() => {
    const path = location.pathname;
    let label = "Projects";

    if (path.startsWith('/project/')) {
      const currentProjectId = path.split('/')[2];
      const project = projectDetails.find(pd => pd.projectId === currentProjectId);
      label = project?.projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${currentProjectId}`;
    } else if (path.startsWith('/profile/')) {
      const currentProfileAddress = path.split('/')[2];
      label = effectiveProfileNfd?.name || `${currentProfileAddress.substring(0, 8)}... Profile`;
    }

    if (!path.startsWith('/profile/') || !nfdLoading) {
      pushEntry({ path, label, activeCategory: undefined });
    }
  }, [location.pathname, projectDetails, pushEntry, effectiveProfileNfd, nfdLoading]);

  const cardContentMaxHeightClass = useMemo(() => {
    if (isMobile && isDeviceLandscape) {
      return "max-h-[calc(100vh-var(--sticky-header-height)-var(--dynamic-nav-buttons-height)-var(--dynamic-nav-buttons-desktop-vertical-gap)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]";
    } else if (isMobile && !isDeviceLandscape) {
      return "max-h-[calc(100vh-var(--sticky-header-height)-var(--dynamic-nav-buttons-height)-var(--mobile-bottom-bar-height)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]";
    } else {
      return "max-h-[calc(100vh-var(--sticky-header-height)-var(--dynamic-nav-buttons-height)-var(--dynamic-nav-buttons-desktop-vertical-gap)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]";
    }
  }, [isMobile, isDeviceLandscape]);

  return (
    <div className="w-full px-0 py-0 md:p-0 text-foreground h-full scroll-mt-header-offset">
      <Carousel setApi={setApi} className="w-full" opts={{ duration: 20 }}>
        <CarouselContent>
          {slidesConfig.map((slide, index) => {
            // Clone the component and inject the isActive prop
            const slideComponent = React.cloneElement(slide.component, {
              isActive: index === currentSlideIndex, // Pass isActive based on currentSlideIndex
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
                      <Footer isMobile={isMobile && !isDeviceLandscape} />
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