"use client";

import { Link, useLocation } from "react-router-dom";
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

interface ProjectPageProps {
  projectId: string | undefined;
  isInsideCarousel?: boolean;
  hashToScroll: string | null; // New prop
  scrollTrigger: number; // New prop
  scrollToTopTrigger?: number; // NEW prop
}

const ProjectPage = ({ projectId, isInsideCarousel = false, hashToScroll, scrollTrigger, scrollToTopTrigger }: ProjectPageProps) => { // Accept scrollToTopTrigger
  const location = useLocation();
  const { projects, loading, error, refetch } = useSocialData();
  const { activeAddress } = useWallet();
  const { peekPreviousEntry } = useNavigationHistory();
  const previousEntry = peekPreviousEntry();
  const { projectDetails } = useProjectDetails();

  const scrollRef = useRef<HTMLDivElement>(null);

  const effectiveProjectId = projectId;

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
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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
        }, 300); // Increased delay to 300ms
      } else {
        console.warn(`[ProjectPage] Element with ID '${id}' not found for scrolling.`);
      }
    }
  }, [scrollTrigger, hashToScroll]); // Depend on trigger and hash

  // NEW: Effect to scroll to top when scrollToTopTrigger changes
  useEffect(() => {
    if (scrollToTopTrigger && scrollRef.current && location.pathname.startsWith('/project/')) {
      console.log("[ProjectPage] Scrolling to top due to trigger.");
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollToTopTrigger, location.pathname]);

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
    <div ref={scrollRef} className={cn(
      "w-full text-foreground h-full overflow-y-auto scroll-mt-header-offset",
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
      />
    </div>
  );
};

export default ProjectPage;