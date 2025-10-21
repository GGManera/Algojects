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
  onScrollToTop: () => void; // Added prop
}

const Projects = ({ isInsideCarousel = false, scrollToTopTrigger, isActive = false, onKeyboardModeChange, onScrollToTop }: ProjectsProps) => {
  const { projects, loading: socialDataLoading, error: socialDataError, isRefreshing: isRefreshingSocialData } = useSocialData(); // NEW: Destructure loading and error
  const { isRefreshing: isRefreshingProjectDetails, loading: projectDetailsLoading, error: projectDetailsError } = useProjectDetails(); // NEW: Destructure loading and error
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
  const isOverallLoading = socialDataLoading || projectDetailsLoading; // NEW: Combine loading states
  const isOverallError = socialDataError || projectDetailsError; // NEW: Combine error states

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

  // The scroll function is now passed directly via prop
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
      "flex flex-col items-center text-foreground space-y-4 relative scroll-mt-header-offset", // Removed h-full and overflow-y-auto
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
        onScrollToTop={onScrollToTop} // Pass the prop directly
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
        {(isOverallLoading || isOverallRefreshing) && ( // NEW: Use combined loading state
          <div className={cn(
            "space-y-4 w-full",
            !isInsideCarousel && "max-w-3xl"
          )}>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {isOverallError && ( // NEW: Use combined error state
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Fetching Data</AlertTitle>
            <AlertDescription>{isOverallError}</AlertDescription>
          </Alert>
        )}
        {!isOverallLoading && !isOverallError && !isOverallRefreshing && ( // NEW: Use combined loading and error states
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