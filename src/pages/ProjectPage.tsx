"use client";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSocialData } from "@/hooks/useSocialData";
import { ProjectDetailCard } from "@/components/ProjectDetailCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import React, { useRef, useEffect, useMemo } from "react";
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation"; // NEW Import

interface ProjectPageProps {
  projectId: string | undefined;
  isInsideCarousel?: boolean;
  hashToScroll: string | null; // New prop
  scrollTrigger: number; // New prop
  scrollToTopTrigger?: number; // NEW prop
  isActive?: boolean; // NEW prop
  onKeyboardModeChange?: (isActive: boolean) => void; // NEW PROP
  onScrollToTop: () => void; // Added prop
}

const ProjectPage = ({ projectId, isInsideCarousel = false, hashToScroll, scrollTrigger, scrollToTopTrigger, isActive = false, onKeyboardModeChange, onScrollToTop }: ProjectPageProps) => { // Accept onScrollToTop
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, loading, error, refetch } = useSocialData();
  const { activeAddress } = useWallet();
  const { peekPreviousEntry } = useNavigationHistory();
  const previousEntry = peekPreviousEntry();
  const { projectDetails } = useProjectDetails();

  const scrollRef = useRef<HTMLDivElement>(null);

  const effectiveProjectId = projectId;
  const pageKey = `project-page-${effectiveProjectId}`; // Unique key for navigation hook

  // NEW: Initialize keyboard navigation hook, dependent on isActive
  const { focusedId, registerItem, rebuildOrder, setLastActiveId, isKeyboardModeActive, setFocusedId } = useKeyboardNavigation(isActive ? pageKey : 'inactive');

  // NEW: Report keyboard mode change up to parent
  useEffect(() => {
    if (isActive && onKeyboardModeChange) {
      onKeyboardModeChange(isKeyboardModeActive);
    }
  }, [isActive, isKeyboardModeActive, onKeyboardModeChange]);

  // NEW: Effect to rebuild order when active
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        rebuildOrder();
      }, 100); // Delay to ensure DOM is fully rendered
      return () => clearTimeout(timer);
    }
  }, [isActive, rebuildOrder]);

  // All hooks must be called unconditionally at the top level
  const currentProjectDetailsEntry = useMemo(() => {
    return projectDetails.find(pd => pd.projectId === effectiveProjectId);
  }, [projectDetails, effectiveProjectId]);

  const currentProjectName = useMemo(() => {
    return currentProjectDetailsEntry?.projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${effectiveProjectId}`;
  }, [currentProjectDetailsEntry, effectiveProjectId]);

  const project = useMemo(() => {
    return effectiveProjectId ? projects[effectiveProjectId] : undefined;
  }, [effectiveProjectId, projects]);

  useEffect(() => {
    if (location.pathname.startsWith('/project/') && scrollRef.current) {
      // Removed local scroll to top logic here, relying on parent scroll
    }
  }, [location.pathname]);

  // New useEffect to handle scrolling based on props from parent
  useEffect(() => {
    if (scrollTrigger > 0 && hashToScroll) { // Only scroll if trigger is active and hash exists
      const id = hashToScroll.substring(1);
      const element = document.getElementById(id);
      if (element) {
        console.log(`[ProjectPage] Scrolling to element with ID: ${id}`);
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // NEW: Clear the hash from the URL after successful scroll
          if (location.hash) {
            // Use replace to avoid adding a new history entry
            navigate(location.pathname, { replace: true });
          }
        }, 300); // Increased delay to 300ms
      } else {
        console.warn(`[ProjectPage] Element with ID '${id}' not found for scrolling.`);
      }
    }
  }, [scrollTrigger, hashToScroll, location.pathname, location.hash, navigate]); // Depend on trigger, hash, and navigate

  // NEW: Effect to scroll to top when scrollToTopTrigger changes
  useEffect(() => {
    if (scrollToTopTrigger && location.pathname.startsWith('/project/')) {
      console.log("[ProjectPage] Scrolling to top due to trigger.");
      onScrollToTop(); // Use the function provided by the parent (NewWebsite)
    }
  }, [scrollToTopTrigger, location.pathname, onScrollToTop]);

  if (!effectiveProjectId) {
    return (
      <div className={cn(
        "w-full h-full flex items-center justify-center",
        !isInsideCarousel && "max-w-3xl mx-auto",
        isInsideCarousel ? "px-0 py-0 md:p-0" : "px-2 py-2 md:p-4"
      )}>
        <p className="text-muted-foreground">Select a project to view details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(
        "w-full",
        !isInsideCarousel && "max-w-3xl mx-auto",
        isInsideCarousel ? "px-0 py-0 md:p-0" : "px-2 py-2 md:p-4"
      )}>
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "w-full",
        !isInsideCarousel && "max-w-3xl mx-auto",
        isInsideCarousel ? "px-0 py-0 md:p-0" : "px-2 py-2 md:p-4"
      )}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={cn(
        "w-full text-center",
        !isInsideCarousel && "max-w-3xl mx-auto",
        isInsideCarousel ? "px-0 py-0 md:p-0" : "px-2 py-2 md:p-4"
      )}>
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Project Not Found</AlertTitle>
          <AlertDescription>The project with ID "{effectiveProjectId}" could not be found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div id={pageKey} className={cn( // Set pageKey as ID here
      "w-full text-foreground", // Removed h-full and overflow-y-auto
      !isInsideCarousel && "max-w-3xl mx-auto",
      isInsideCarousel ? "px-0 py-0 md:p-0" : "px-2 py-2 md:p-4"
    )}>
      <ProjectDetailCard
        project={project}
        projectsData={projects}
        activeAddress={activeAddress}
        onInteractionSuccess={refetch}
        currentProjectName={currentProjectName} // This prop is now derived internally by ProjectDetailCard
        isInsideCarousel={isInsideCarousel}
        // NEW: Pass keyboard navigation props
        focusedId={focusedId}
        registerItem={registerItem}
        isActive={isActive}
        setLastActiveId={setLastActiveId} // NEW
        setFocusedId={setFocusedId} // NEW: Pass setFocusedId
      />
    </div>
  );
};

export default ProjectPage;