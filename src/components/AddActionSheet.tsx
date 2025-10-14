"use client";

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectsData } from '@/types/social';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode
import { cn } from '@/lib/utils'; // Import cn for conditional classNames

interface AddActionSheetProps {
  children: React.ReactNode;
  projects: ProjectsData;
  onInteractionSuccess: () => void;
}

export function AddActionSheet({ children, projects, onInteractionSuccess }: AddActionSheetProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const { isMobile } = useAppContextDisplayMode(); // Use the hook to check if it's mobile

  const handleNewProjectClick = () => {
    setIsSheetOpen(false);
    setIsNewProjectDialogOpen(true);
  };

  return (
    <>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          {children}
        </SheetTrigger>
        <SheetContent side="bottom" className="bg-card text-foreground rounded-t-xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="gradient-text">What do you want to add?</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4">
            {isMobile ? (
              <div
                className={cn(
                  "btn-profile mx-auto max-w-[200px]", // Changed w-full to max-w-[200px]
                  "flex items-center justify-center"
                )}
                onClick={handleNewProjectClick}
              >
                <strong className="uppercase">Add New Project</strong>
                <PlusCircle className="h-4 w-4 ml-2" />
                <div id="container-stars">
                  <div id="stars"></div>
                </div>
                <div id="glow">
                  <div className="circle"></div>
                  <div className="circle"></div>
                </div>
              </div>
            ) : (
              <Button onClick={handleNewProjectClick} className="w-full">
                <PlusCircle className="h-4 w-4 mr-2" /> Add New Project
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <NewProjectDialog
        isOpen={isNewProjectDialogOpen}
        onOpenChange={setIsNewProjectDialogOpen}
        projects={projects}
        onInteractionSuccess={onInteractionSuccess}
      />
    </>
  );
}