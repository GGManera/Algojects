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
import { ProjectTagFilter } from "@/components/ProjectTagFilter";
import { Separator } from "@/components/ui/separator";
import { TagFilterModeToggle } from "@/components/TagFilterModeToggle"; // NEW Import

interface ProjectsProps {
  isInsideCarousel?: boolean;
  scrollToTopTrigger?: number;
  isActive?: boolean;
  onKeyboardModeChange?: (isActive: boolean) => void;
  onScrollToTop: () => void; // Added prop
}

const Projects = ({ isInsideCarousel = false, scrollToTopTrigger, isActive = false, onKeyboardModeChange, onScrollToTop }: ProjectsProps) => {
  const { projects, loading: socialDataLoading, error: socialDataError, isRefreshing: isRefreshingSocialData } = useSocialData();
  const { projectDetails, loading: projectDetailsLoading, error: projectDetailsError, isRefreshing: isRefreshingProjectDetails } = useProjectDetails();
  const { activeAddress } = useWallet();
  const { isMobile, appDisplayMode } = useAppContextDisplayMode();
  const { setHeroLogoVisibility } = useHeroLogoVisibility();
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => new Set());
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'combined' | 'any'>('any'); // NEW STATE // Changed default to 'any'
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
  const isOverallLoading = socialDataLoading || projectDetailsLoading;
  const isOverallError = socialDataError || projectDetailsError;

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
      if (selectedTags.length === 0) return true;

      const projectDetail = projectDetails.find(pd => pd.projectId === project.id);
      const projectTagsItem = projectDetail?.projectMetadata.find(item => item.type === 'tags');
      
      if (!projectTagsItem || !projectTagsItem.value) return false;

      const projectTags = projectTagsItem.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      
      if (filterMode === 'combined') {
        // AND logic: project must have ALL selected tags
        return selectedTags.every(selectedTag => projectTags.includes(selectedTag));
      } else {
        // OR logic: project must have ANY of the selected tags
        return selectedTags.some(selectedTag => projectTags.includes(selectedTag));
      }
    });

    // 2. Sorting
    return filteredProjects.sort((a, b) => {
      const scoreA = calculateProjectInteractionScore(a);
      const scoreB = calculateProjectInteractionScore(b);
      return scoreB - scoreA;
    });
  }, [projects, projectDetails, selectedTags, filterMode]); // ADD filterMode dependency

  const isButtonRendered = shouldShowAddProjectButton && activeAddress;
  
  // NEW: Function to clear all filters
  const handleClearAllFilters = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const isFilterActive = selectedTags.length > 0;

  return (
    <div id={pageKey} ref={projectsPageRef} className={cn(
      "flex flex-col items-center text-foreground relative scroll-mt-header-offset",
      isInsideCarousel ? "px-2 md:px-0" : "px-2 md:px-4"
    )}>
      <HeroSection 
        heroLogoRef={heroLogoRef} 
        isInsideCarousel={isInsideCarousel} 
        focusedId={focusedId}
        registerItem={registerItem}
        isActive={isActive}
        setLastActiveId={setLastActiveId}
        onScrollToTop={onScrollToTop}
      />

      <RevenueCalculator 
        className="mt-0"
        isInsideCarousel={isInsideCarousel} 
        focusedId={focusedId}
        registerItem={registerItem}
        isActive={isActive}
        setLastActiveId={setLastActiveId}
        rebuildOrder={rebuildOrder}
      />

      {isButtonRendered ? (
        <div className="my-8">
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
        </div>
      ) : (
        <div className="mt-8"></div>
      )}
      
      {/* Container for Title and Separator */}
      <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
        <h2 
          className={cn(
            "text-4xl font-bold gradient-text mb-0 cursor-pointer",
            !isButtonRendered && "mt-8"
          )}
          onClick={handleClearAllFilters}
          title={isFilterActive ? "Click to clear filters" : "All Projects"}
        >
          All Projects
        </h2>
        
        {/* Horizontal line when filter is active - Fixed height container */}
        <div className="w-full flex justify-center min-h-[1.5rem] mb-4">
          <AnimatePresence>
            {isFilterActive && (
              <motion.div
                key="filter-separator"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '100%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-[200px]"
              >
                <Separator className="bg-border-accent-green h-[2px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* NEW: Tag Filter Mode Toggle - Centered */}
      <div className="w-full max-w-3xl mx-auto mb-4 flex justify-center">
        <TagFilterModeToggle 
          mode={filterMode} 
          onModeChange={setFilterMode} 
          disabled={isOverallLoading || isOverallRefreshing}
        />
      </div>

      {/* Project Tag Filter (Not animated) */}
      <ProjectTagFilter
        projects={projects}
        projectDetails={projectDetails}
        isLoading={isOverallLoading}
        onFilterChange={setSelectedTags}
        selectedTags={new Set(selectedTags)}
      />
      
      {/* NEW: Filtered Project Count */}
      <AnimatePresence>
        {selectedTags.length > 0 && (
          <motion.p
            key="project-count"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-muted-foreground mt-4 mb-4 w-full max-w-3xl mx-auto text-center"
          >
            <span className="font-numeric font-bold text-foreground">{sortedAndFilteredProjects.length}</span> projects found matching the filter.
          </motion.p>
        )}
      </AnimatePresence>

      {/* Animate the project list based on selectedTags */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTags.join(',') + filterMode} // ADD filterMode to key
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "w-full flex flex-col items-center mt-4",
            !isInsideCarousel && "max-w-4xl"
          )}
        >
          {(isOverallLoading || isOverallRefreshing) && (
            <div className={cn(
              "space-y-4 w-full",
              !isInsideCarousel && "max-w-3xl"
            )}>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {isOverallError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Fetching Data</AlertTitle>
              <AlertDescription>{isOverallError}</AlertDescription>
            </Alert>
          )}
          {!isOverallLoading && !isOverallError && !isOverallRefreshing && (
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
                    rebuildOrder={rebuildOrder}
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
        </motion.div>
      </AnimatePresence>

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