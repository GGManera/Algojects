"use client";

import React, { useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Projects from '@/pages/Projects';
import ProjectPage from '@/pages/ProjectPage';
import UserProfile from '@/pages/UserProfile';
import NewWebsite from '@/pages/NewWebsite'; // NEW: Import NewWebsite
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { useWallet } from '@txnlab/use-wallet-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from '@/lib/utils';

export function CarouselNavigator() {
  const location = useLocation();
  const navigate = useNavigate();
  const { historyStack, lastProjectPath, lastProfilePath } = useNavigationHistory();
  const { activeAddress } = useWallet();

  const [api, setApi] = React.useState<CarouselApi>();
  const [currentSlideIndex, setCurrentSlideIndex] = React.useState(0); // 0: Projects, 1: ProjectPage, 2: UserProfile, 3: NewWebsite

  const { projectId, addressFromUrl } = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    let pId: string | undefined;
    let addr: string | undefined;

    if (pathParts[0] === 'project' && pathParts[1]) {
      pId = pathParts[1];
    } else if (pathParts[0] === 'profile' && pathParts[1]) {
      addr = pathParts[1];
    }

    return { projectId: pId, addressFromUrl: addr };
  }, [location.pathname]);

  // Determine the address to pass to UserProfile: URL param first, then active wallet address
  const profileAddressToDisplay = addressFromUrl || activeAddress;

  // Determine the target slide index based on the current URL
  const targetSlideIndex = useMemo(() => {
    if (location.pathname.startsWith('/profile/')) return 2; // UserProfile
    if (location.pathname.startsWith('/project/')) return 1; // ProjectPage
    if (location.pathname === '/new-website') return 3; // NEW: NewWebsite
    return 0; // Projects (Home)
  }, [location.pathname]);

  // Effect to synchronize Carousel with URL changes and handle redirection
  useEffect(() => {
    if (!api) return;

    // This listener will update the URL when the carousel is manually swiped
    const handleSelect = () => {
      const newIndex = api.selectedScrollSnap();
      setCurrentSlideIndex(newIndex); // Update internal state

      let newPath = location.pathname; // Default to current path

      if (newIndex === 0) { // Projects (Home)
        newPath = '/';
      } else if (newIndex === 1) { // ProjectPage
        if (projectId) { // If a project is already in the URL, keep it
          newPath = `/project/${projectId}`;
        } else if (lastProjectPath) { // Otherwise, go to the last viewed project
          newPath = lastProjectPath.path;
        } else { // If no last project, go to home
          newPath = '/';
        }
      } else if (newIndex === 2) { // UserProfile
        if (addressFromUrl) { // If a profile is already in the URL, keep it
          newPath = `/profile/${addressFromUrl}`;
        } else if (lastProfilePath) { // Otherwise, go to the last viewed profile
          newPath = lastProfilePath.path;
        } else if (activeAddress) { // If no last profile, but wallet connected, go to own profile
          newPath = `/profile/${activeAddress}`;
        } else { // If no profile to show, go to home
          newPath = '/';
        }
      } else if (newIndex === 3) { // NEW: NewWebsite
        newPath = '/new-website';
      }

      // Only navigate if the path is actually changing
      if (newPath !== location.pathname) {
        navigate(newPath);
      }
    };

    api.on("select", handleSelect);

    // Handle redirection for "empty" project or profile pages
    if (location.pathname.startsWith('/project/') && !projectId) {
      navigate('/');
      return;
    }
    if (location.pathname.startsWith('/profile/') && !profileAddressToDisplay) {
      navigate('/');
      return;
    }

    // Programmatically scroll carousel if the URL changes and it's not already on the correct slide
    if (api.selectedScrollSnap() !== targetSlideIndex) {
      api.scrollTo(targetSlideIndex);
    }

    return () => {
      api.off("select", handleSelect);
    };
  }, [api, targetSlideIndex, location.pathname, projectId, addressFromUrl, profileAddressToDisplay, navigate, lastProjectPath, lastProfilePath, activeAddress]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTagName = (e.target as HTMLElement).tagName;
      if (targetTagName === 'INPUT' || targetTagName === 'TEXTAREA') {
        return;
      }

      const findLastPath = (type: 'project' | 'profile'): string | null => {
        for (let i = historyStack.length - 1; i >= 0; i--) {
          if (historyStack[i].path.startsWith(`/${type}/`)) {
            return historyStack[i].path;
          }
        }
        return null;
      };

      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        if (targetSlideIndex === 0) { // On Projects (Home)
          const lastProjectPath = findLastPath('project');
          if (lastProjectPath) {
            navigate(lastProjectPath);
          } else if (activeAddress) { // If no last project, but wallet connected, go to own profile
            navigate(`/profile/${activeAddress}`);
          }
        } else if (targetSlideIndex === 1) { // On Project Page
          if (profileAddressToDisplay) { // If there's a profile to show, go there
            navigate(`/profile/${profileAddressToDisplay}`);
          }
        } else if (targetSlideIndex === 2) { // On User Profile
          navigate('/new-website'); // NEW: Go to NewWebsite from Profile
        }
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        if (targetSlideIndex === 3) { // On NewWebsite
          if (profileAddressToDisplay) { // If there's a profile to show, go there
            navigate(`/profile/${profileAddressToDisplay}`);
          } else { // If no profile, go to home
            navigate('/');
          }
        } else if (targetSlideIndex === 2) { // On Profile Page
          const lastProjectPath = findLastPath('project');
          if (lastProjectPath) {
            navigate(lastProjectPath);
          } else { // If no last project, go to home
            navigate('/');
          }
        } else if (targetSlideIndex === 1) { // On Project Page
          navigate('/'); // Always go to home from project page
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [targetSlideIndex, navigate, historyStack, activeAddress, projectId, profileAddressToDisplay]);

  // Extract last viewed project/profile IDs from history for persistence
  const lastViewedProjectId = lastProjectPath?.path.split('/')[2];
  const lastViewedProfileAddress = lastProfilePath?.path.split('/')[2];

  return (
    <Carousel setApi={setApi} className="w-full h-full" opts={{ duration: 20 }}>
      <CarouselContent className="h-full">
        {/* Slide 1: Projects (Home Page) */}
        <CarouselItem className="h-full">
          <Projects />
        </CarouselItem>

        {/* Slide 2: Project Page - Always render, ProjectPage handles empty state */}
        <CarouselItem className="h-full">
          <ProjectPage projectId={projectId} lastViewedProjectId={lastViewedProjectId} />
        </CarouselItem>

        {/* Slide 3: User Profile Page - Always render, UserProfile handles empty state */}
        <CarouselItem className="h-full">
          <UserProfile address={profileAddressToDisplay} lastViewedAddress={lastViewedProfileAddress} />
        </CarouselItem>

        {/* NEW: Slide 4: NewWebsite Page */}
        <CarouselItem className="h-full">
          <NewWebsite
            projectIdFromCarousel={projectId} // Pass projectId from URL
            lastViewedProjectIdFromCarousel={lastViewedProjectId} // Pass last viewed from history
            profileAddressFromCarousel={profileAddressToDisplay} // NEW: Pass profile address
            lastViewedProfileAddressFromCarousel={lastViewedProfileAddress} // NEW: Pass last viewed profile address
          />
        </CarouselItem>
      </CarouselContent>
    </Carousel>
  );
}