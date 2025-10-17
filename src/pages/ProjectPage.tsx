"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useWallet } from '@txnlab/use-wallet-react';
import { ArrowLeft, ArrowRight, Repeat2, Loader2, MessageSquare, User, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import ProjectDetailCard from '@/components/ProjectDetailCard'; // Import the updated component
import { ProjectReviewList } from '@/components/ProjectReviewList';
import { ProjectSummaryCard } from '@/components/ProjectSummaryCard';
import { ProjectMetadataItem } from '@/types/project'; // Assuming this type exists

interface ProjectPageProps {
  projectId?: string;
  isInsideCarousel?: boolean;
  hashToScroll?: string | null;
  scrollTrigger?: number;
  scrollToTopTrigger?: number;
}

const ProjectPage: React.FC<ProjectPageProps> = ({ 
  projectId: propProjectId, 
  isInsideCarousel = false,
  hashToScroll,
  scrollTrigger,
  scrollToTopTrigger
}) => {
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const { activeAddress } = useWallet();
  const { projectDetails, loading, error, refetchProjectDetails } = useProjectDetails();
  const { isMobile } = useAppContextDisplayMode();

  const effectiveProjectId = propProjectId || paramProjectId;
  const project = useMemo(() => projectDetails.find(p => p.projectId === effectiveProjectId), [projectDetails, effectiveProjectId]);
  
  // Keyboard Navigation Setup
  const pageKey = `project-${effectiveProjectId}`;
  const { focusedId, registerItem, rebuildOrder, setLastActiveId } = useKeyboardNavigation(pageKey);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // --- Scroll Management ---
  useEffect(() => {
    if (scrollTrigger && hashToScroll && containerRef.current) {
      const targetElement = document.querySelector(hashToScroll);
      if (targetElement) {
        // Calculate offset to account for sticky header/padding
        const offset = isMobile ? 16 : 24; 
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + containerRef.current.scrollTop - offset;

        containerRef.current.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [scrollTrigger, hashToScroll, isMobile]);

  useEffect(() => {
    if (scrollToTopTrigger) {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollToTopTrigger]);

  // --- Keyboard Navigation Rebuild ---
  useEffect(() => {
    if (project && !loading) {
      // Rebuild order after content loads
      const orderedIds = rebuildOrder();
      
      // If this is the initial load of the page, and we have a hash, scroll to it
      if (isInitialLoad && hashToScroll) {
        // Scroll logic is handled by the scrollTrigger effect above
        setIsInitialLoad(false);
      } else if (isInitialLoad && orderedIds.length > 0) {
        // If no hash, ensure the first item is focused and visible on initial load
        const element = document.querySelector(`[data-nav-id="${orderedIds[0]}"]`);
        if (element) {
          element.scrollIntoView({ block: 'start' });
        }
        setIsInitialLoad(false);
      }
    }
  }, [project, loading, rebuildOrder, isInitialLoad, hashToScroll]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-xl font-semibold text-red-500">Error Loading Project</h2>
        <p className="text-muted-foreground">Could not find project details for ID: {effectiveProjectId}</p>
        <Button onClick={refetchProjectDetails} className="mt-4">
          <Repeat2 className="w-4 h-4 mr-2" /> Try Again
        </Button>
      </div>
    );
  }

  const projectDescription = project.projectMetadata.find(item => item.type === 'project-description')?.value || 'No description provided.';
  const projectMetadata = project.projectMetadata as ProjectMetadataItem[];

  return (
    <div 
      id={pageKey} 
      ref={containerRef} 
      className={cn("p-4 md:p-6 space-y-6", {
        "h-full overflow-y-auto": isInsideCarousel // Only apply scroll classes if inside carousel
      })}
    >
      {/* Project Summary Card (Always first navigable item) */}
      <ProjectSummaryCard 
        project={project} 
        focusedId={focusedId} 
        registerItem={registerItem} 
        setLastActiveId={setLastActiveId}
      />

      <Separator />

      {/* Project Details and Metadata */}
      <ProjectDetailCard 
        metadata={projectMetadata} 
        description={projectDescription} 
      />

      <Separator />

      {/* Reviews Section */}
      <ProjectReviewList 
        projectId={effectiveProjectId!} 
        reviews={project.reviews} 
        focusedId={focusedId} 
        registerItem={registerItem} 
        setLastActiveId={setLastActiveId}
      />
      
      {/* Placeholder for navigation instructions */}
      {!isMobile && (
        <div className="flex justify-between text-xs text-muted-foreground pt-4">
          <div className="flex items-center space-x-1">
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Projects</span>
          </div>
          <div className="flex items-center space-x-1">
            <span>Navigate items</span>
            <span className="font-mono">W/S</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPage;