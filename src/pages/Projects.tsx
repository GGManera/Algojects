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
import { Project } from "@/types/social";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from '@/lib/utils';
import { HeroSection } from "@/components/HeroSection";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { ProjectTagFilter } from "@/components/ProjectTagFilter"; // NEW Import
import { Separator } from "@/components/ui/separator"; // NEW Import

interface ProjectsProps {
  isInsideCarousel?: boolean;
  scrollToTopTrigger?: number;
  isActive?: boolean;
  onKeyboardModeChange?: (isActive: boolean) => void;
  onScrollToTop: () => void; // Added prop
}

const Projects = ({ isInsideCarousel = false, scrollToTopTrigger, isActive = false, onKeyboardModeChange, onScrollToTop }: ProjectsProps) => {
  const { projects, loading: socialDataLoading, error: socialDataError, isRefreshing: isRefreshingSocialData } = useSocialData(); // NEW: Destructure loading and error
  const { projectDetails, loading: projectDetailsLoading, error: projectDetailsError, isRefreshing: isRefreshingProjectDetails } = useProjectDetails(); // NEW: Destructure loading and error
  const { activeAddress } = useWallet();
  const { isMobile, appDisplayMode } = useAppContextDisplayMode();
  const { setHeroLogoVisibility } = useHeroLogoVisibility();
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => new Set());
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // NEW State for selected tags
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

  const sortedAndFilteredProjects = useMemo(() => {
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

    // 1. Filtering
    const filteredProjects = projectList.filter(project => {
      if (selectedTags.length === 0) return true; // No filter applied

      const projectDetail = projectDetails.find(pd => pd.projectId === project.id);
      const projectTagsItem = projectDetail?.projectMetadata.find(item => item.type === 'tags');
      
      if (!projectTagsItem || !projectTagsItem.value) return false; // Project has no tags, filter it out

      const projectTags = projectTagsItem.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      
      // Check if the project has ALL of the selected tags
      return selectedTags.every(selectedTag => projectTags.includes(selectedTag));
    });

    // 2. Sorting
    return filteredProjects.sort((a, b) => {
      const scoreA = calculateProjectInteractionScore(a);
      const scoreB = calculateProjectInteractionScore(b);
      return scoreB - scoreA;
    });
  }, [projects, projectDetails, selectedTags]); // Added selectedTags dependency

  const isButtonRendered = shouldShowAddProjectButton && activeAddress;
  
  // NEW: Function to clear all filters
  const handleClearAllFilters = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const isFilterActive = selectedTags.length > 0;

  return (
    <div id={pageKey} ref={projectsPageRef} className={cn(
      "flex flex-col items-center text-foreground relative scroll-mt-header-offset", // Removed space-y-4
      isInsideCarousel ? "px-2 md:px-0" : "px-2 md:px-4" // ADDED px-2 for mobile carousel
    )}>
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
        className="mt-0" // Removed mb-8
        isInsideCarousel={isInsideCarousel} 
        focusedId={focusedId}
        registerItem={registerItem}
        isActive={isActive}
        setLastActiveId={setLastActiveId}
        rebuildOrder={rebuildOrder} // NEW: Pass rebuildOrder
      />

      {isButtonRendered ? (
        <div className="my-8"> {/* Container with vertical margin (my-8) */}
          <button
            className="btn-profile mx-auto" // Removed mb-4
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
        </div>
      ) : (
        <div className="mt-8"></div> // Placeholder for spacing when button is hidden
      )}
      
      {/* Container for Title and Separator - Adjusted for fixed height and centered content */}
      <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
        <h2 
          className={cn(
            "text-4xl font-bold gradient-text mb-0 cursor-pointer", // Removed mb-4, set mb-0
            !isButtonRendered && "mt-8" // Apply mt-8 only if the button container was NOT rendered
          )}
          onClick={handleClearAllFilters}
          title={isFilterActive ? "Click to clear filters" : "All Projects"}
        >
          All Projects
        </h2>
        
        {/* NEW: Horizontal line when filter is active - Fixed height container */}
        <div className="w-full flex justify-center min-h-[1.5rem] mb-4"> {/* min-h-[1.5rem] reserves space, mb-4 pushes down the filter cards */}
          <AnimatePresence>
            {isFilterActive && (
              <motion.div
                key="filter-separator"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '100%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-[150px]" // Reduced max-width to 150px
              >
                <Separator className="bg-border-accent-green h-[2px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* NEW: Project Tag Filter (Now inline) */}
      <ProjectTagFilter
        projects={projects}
        projectDetails={projectDetails}
        isLoading={isOverallLoading}
        onFilterChange={setSelectedTags}
        selectedTags={new Set(selectedTags)} // Pass selectedTags as a Set for visual state
      />

      <div className={cn(
        "w-full flex flex-col items-center mt-4", // Added mt-4 for spacing below the filter
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
            {sortedAndFilteredProjects.length > 0 ? (
              sortedAndFilteredProjects.map(project => (
                <ProjectSummaryCard
                  key={project.id}
                  project={project}
                  isExpanded={expandedProjectIds.has(project.id)}
                  onToggleExpand={handleToggleExpand}
                  cardRef={(el) => projectCardRefs.current.set(project.id, el)}
                  isInsideCarousel={isInsideCarousel}
                  focusedId={focusedId}
                  registerItem={registerItem}
                  rebuildOrder={rebuildOrder} // NEW: Pass rebuildOrder
                  isActive={isActive}
                  setLastActiveId={setLastActiveId}
                />
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No projects match the selected tags.
              </p>
            )}
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