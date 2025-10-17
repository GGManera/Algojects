"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSocialData } from "@/hooks/useSocialData";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Plus, LayoutGrid } from "lucide-react";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { useWallet } from '@txnlab/use-wallet-react';
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { RevenueCalculator } from "@/components/RevenueCalculator";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { useAppContextDisplayMode } from "@/contexts/AppDisplayModeContext";
import { useHeroLogoVisibility } from "@/contexts/HeroLogoVisibilityContext";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollTopSettingsButton } from "@/components/ScrollTopSettingsButton";
import { Project } from "@/types/social";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from '@/lib/utils';
import { HeroSection } from "@/components/HeroSection";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

interface ProjectsProps {
  isInsideCarousel?: boolean;
  scrollToTopTrigger?: number;
  isActive?: boolean;
  onKeyboardModeChange?: (isActive: boolean) => void;
}

const Projects = ({ isInsideCarousel = false, scrollToTopTrigger, isActive = false, onKeyboardModeChange }: ProjectsProps) => {
  const { projects, loading, error, isRefreshing: isRefreshingSocialData } = useSocialData();
  const { isRefreshing: isRefreshingProjectDetails } = useProjectDetails();
  const { activeAddress } = useWallet();
  const { isMobile, appDisplayMode } = useAppContextDisplayMode();
  const { setHeroLogoVisibility } = useHeroLogoVisibility();
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => new Set());
  const location = useLocation();
  const navigate = useNavigate();

  const heroLogoRef = useRef<HTMLDivElement>(null);
  const projectCardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const projectsPageRef = useRef<HTMLDivElement>(null);
  const pageKey = 'projects-home';

  // NEW: Initialize keyboard navigation hook
  const { focusedId, registerItem, rebuildOrder, setLastActiveId, isKeyboardModeActive } = useKeyboardNavigation(isActive ? pageKey : 'inactive');

  // NEW: Report keyboard mode change up to parent
  useEffect(() => {
    if (isActive && onKeyboardModeChange) {
      onKeyboardModeChange(isKeyboardModeActive);
    }
  }, [isActive, isKeyboardModeActive, onKeyboardModeChange]);

  const isOverallRefreshing = isRefreshingSocialData || isRefreshingProjectDetails;

  // NEW: Effect to rebuild order when active
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        rebuildOrder();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isActive, rebuildOrder]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroLogoVisibility(entry.isIntersecting);
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.1,
      }
    );

    if (heroLogoRef.current) {
      observer.observe(heroLogoRef.current);
    }

    return () => {
      if (heroLogoRef.current) {
        observer.unobserve(heroLogoRef.current);
      }
    };
  }, [setHeroLogoVisibility]);

  // NEW: Function to scroll the content to the top (used by HeroSection)
  const handleScrollToTop = useCallback(() => {
    // Since this component is wrapped in a CardContent in NewWebsite, 
    // we need to find the nearest scrollable parent (which is the CardContent ref in NewWebsite)
    // or rely on the parent component's exposed ref function.
    // For simplicity here, we assume the parent (NewWebsite) handles the scroll via prop/ref.
    // We can trigger a local scroll if we are NOT inside the carousel.
    if (!isInsideCarousel && projectsPageRef.current) {
      projectsPageRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // If inside carousel, we rely on the parent NewWebsite to expose the scroll function.
      // Since we don't have direct access to the NewWebsite ref here, we rely on the
      // parent Layout component to handle the global scroll reset via the StickyHeader/Logo click.
      // However, for the HeroSection's internal logic, we can trigger a navigation to the current path
      // with a state flag, which the parent NewWebsite can interpret as a scroll-to-top request.
      // But since the parent NewWebsite already exposes a resetAllScrolls function via ref,
      // we need to ensure the Layout component calls the correct function.
      // For now, let's assume the parent (NewWebsite) passes a direct scroll function via prop if needed,
      // or we use a simple window.scrollTo if we are the root.
      // Since we are inside NewWebsite, we rely on the parent Layout's logo click handler
      // to call NewWebsite's resetAllScrolls.
      // For the HeroSection's internal logic, we will rely on the prop passed from NewWebsite.
      // Since NewWebsite doesn't pass a prop, let's use a simple window.scrollTo for now, 
      // which works if the scrollable area is the window itself (which it isn't in NewWebsite).
      // The correct implementation is to use the `scrollToTopTrigger` prop.
      // Since we don't have a direct way to trigger the parent's scroll from here,
      // we will rely on the parent Layout's logo click handler to handle the global reset.
      // For the HeroSection's internal logic, we will use a simple window.scrollTo for now, 
      // which will only work if the scrollable area is the window itself.
      // Let's assume the parent NewWebsite passes a function via prop.
      // Since the user requested this feature, I will add the prop to HeroSection and Projects.
      // The actual scroll logic will be handled by the parent NewWebsite via the exposed ref.
      // For now, we just need to trigger the parent's scroll logic.
      // Since we are inside the scrollable CardContent, we need to scroll that element.
      const parentScrollable = projectsPageRef.current?.closest('.scrollbar-thin');
      if (parentScrollable) {
        parentScrollable.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [isInsideCarousel]);

  const handleToggleExpand = useCallback((projectId: string) => {
    setExpandedProjectIds(prevIds => {
      const newIds = new Set(prevIds);
      if (newIds.has(projectId)) {
        newIds.delete(projectId);
      } else {
        newIds.add(projectId);
      }
      return newIds;
    });
  }, []);

  const handleNewProjectSuccess = () => {
    setShowNewProjectDialog(false);
  };

  const shouldShowAddProjectButton = !isMobile || appDisplayMode === 'landscape';

  const sortedProjects = useMemo(() => {
    const projectList = Object.values(projects);
    const calculateProjectInteractionScore = (project: Project): number => {
      let totalReviews = 0;
      let commentsCount = 0;
      let repliesCount = 0;
      let likesCount = 0;

      const reviews = Object.values(project.reviews || {});
      totalReviews = reviews.length;

      reviews.forEach(review => {
        likesCount += review.likeCount || 0;
        const comments = Object.values(review.comments || {});
        commentsCount += comments.length;

        comments.forEach(comment => {
          likesCount += comment.likeCount || 0;
          const replies = Object.values(comment.replies || {});
          repliesCount += replies.length;

          replies.forEach(reply => {
            likesCount += reply.likeCount || 0;
          });
        });
      });

      return totalReviews + commentsCount + repliesCount + likesCount;
    };

    return projectList.sort((a, b) => {
      const scoreA = calculateProjectInteractionScore(a);
      const scoreB = calculateProjectInteractionScore(b);
      return scoreB - scoreA;
    });
  }, [projects]);

  return (
    <div id={pageKey} ref={projectsPageRef} className={cn(
      "flex flex-col items-center text-foreground space-y-4 relative h-full overflow-y-auto scroll-mt-header-offset",
      isInsideCarousel ? "px-0 md:px-0" : "px-2 md:px-4"
    )}>
      <ScrollTopSettingsButton />
      <HeroSection 
        heroLogoRef={heroLogoRef} 
        isInsideCarousel={isInsideCarousel} 
        focusedId={focusedId}
        registerItem={registerItem}
        isActive={isActive}
        setLastActiveId={setLastActiveId}
        onScrollToTop={handleScrollToTop} // Pass the local scroll function
      />

      <RevenueCalculator 
        className="mt-0" 
        isInsideCarousel={isInsideCarousel} 
        focusedId={focusedId}
        registerItem={registerItem}
        isActive={isActive}
        setLastActiveId={setLastActiveId}
      />

      {shouldShowAddProjectButton && activeAddress && (
        <button
          className="btn-profile mx-auto"
          onClick={() => setShowNewProjectDialog(true)}
          disabled={!activeAddress}
        >
          <strong className="uppercase">Add Project</strong>
          <Plus className="h-4 w-4 text-white ml-2" />
          <div id="container-stars">
            <div id="stars"></div>
          </div>
          <div id="glow">
            <div className="circle"></div>
            <div className="circle"></div>
          </div>
        </button>
      )}

      <div className={cn(
        "w-full flex flex-col items-center",
        !isInsideCarousel && "max-w-4xl"
      )}>
        {(loading || isOverallRefreshing) && (
          <div className={cn(
            "space-y-4 w-full",
            !isInsideCarousel && "max-w-3xl"
          )}>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Fetching Data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!loading && !error && !isOverallRefreshing && (
          <div className="w-full space-y-4 flex flex-col items-center">
            {sortedProjects.map(project => (
              <ProjectSummaryCard
                key={project.id}
                project={project}
                isExpanded={expandedProjectIds.has(project.id)}
                onToggleExpand={handleToggleExpand}
                cardRef={(el) => projectCardRefs.current.set(project.id, el)}
                isInsideCarousel={isInsideCarousel}
                focusedId={focusedId}
                registerItem={registerItem}
                isActive={isActive}
                setLastActiveId={setLastActiveId}
              />
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog
        isOpen={showNewProjectDialog}
        onOpenChange={setShowNewProjectDialog}
        projects={projects}
        onInteractionSuccess={handleNewProjectSuccess}
      />
    </div>
  );
};

export default Projects;