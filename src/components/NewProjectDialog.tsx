"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewProjectForm } from './NewProjectForm';
import { ProjectsData } from '@/types/social';
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea

interface NewProjectDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectsData;
  onInteractionSuccess: () => void;
}

export function NewProjectDialog({ isOpen, onOpenChange, projects, onInteractionSuccess }: NewProjectDialogProps) {
  const handleSuccess = () => {
    onInteractionSuccess();
    onOpenChange(false); // Close dialog on success
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card text-foreground p-4">
        <DialogHeader>
          <DialogTitle className="gradient-text">Add New Project</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh] pr-4"> {/* Added ScrollArea with max height */}
          <NewProjectForm projects={projects} onInteractionSuccess={handleSuccess} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}