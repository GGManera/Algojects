"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Tag, LayoutGrid, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectsData } from '@/types/social';
import { ProjectDetailsEntry } from '../../api/project-details';
import { AllTagsDialog } from './AllTagsDialog'; // Import the new dialog
import { Skeleton } from './ui/skeleton';
import { AnimatePresence, motion } from 'framer-motion'; // Import motion for smooth transition

interface ProjectTagFilterProps {
  projects: ProjectsData;
  projectDetails: ProjectDetailsEntry[];
  isLoading: boolean;
  onFilterChange: (selectedTags: string[]) => void;
}

interface TagData {
  tag: string;
  count: number;
}

export function ProjectTagFilter({ projects, projectDetails, isLoading, onFilterChange }: ProjectTagFilterProps) {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isAllTagsDialogOpen, setIsAllTagsDialogOpen] = useState(false);

  // 1. Extract all unique tags and count projects for each (sorted by count descending)
  const allTagsData: TagData[] = useMemo(() => {
    const tagCounts = new Map<string, number>();
    
    projectDetails.forEach(detail => {
      const tagsItem = detail.projectMetadata.find(item => item.type === 'tags');
      if (tagsItem && tagsItem.value) {
        const tags = tagsItem.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        
        tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    // Convert map to sorted array
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }, [projectDetails]);

  // 2. Handle tag selection change
  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      onFilterChange(Array.from(newSet));
      return newSet;
    });
  }, [onFilterChange]);
  
  // 3. Handle clear all filters
  const handleClearAll = useCallback(() => {
    setSelectedTags(new Set());
    onFilterChange([]);
  }, [onFilterChange]);

  const topFiveTags = useMemo(() => allTagsData.slice(0, 5), [allTagsData]);
  const hasMoreTags = allTagsData.length > 5;
  const selectedCount = selectedTags.size;

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto grid grid-cols-3 sm:grid-cols-6 gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (allTagsData.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto relative">
      
      {/* NEW: Clear Filter Button (Minimalist 'X') */}
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            key="clear-filter-button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-10 right-0 z-10"
          >
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClearAll} 
              className="h-8 w-8 text-destructive hover:bg-destructive/20"
              title={`Clear ${selectedCount} active filter(s)`}
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {/* Render Top 5 Tags */}
        {topFiveTags.map(({ tag, count }) => {
          const isSelected = selectedTags.has(tag);
          return (
            <button 
              key={tag} 
              type="button"
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-lg border cursor-pointer transition-all duration-200 h-full min-h-10",
                "bg-muted/30 border-muted hover:bg-muted/50",
                isSelected ? "focus-glow-border !border-border-accent-green" : ""
              )}
              onClick={() => handleTagToggle(tag)}
            >
              <span className="text-sm font-medium capitalize leading-tight text-center">
                {tag}
              </span>
              <span className="font-numeric text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <LayoutGrid className="h-3 w-3" /> {count}
              </span>
            </button>
          );
        })}
        
        {/* Render All Tags Button (6th item) */}
        {hasMoreTags && (
          <button
            type="button"
            className="flex flex-col items-center justify-center p-2 rounded-lg border cursor-pointer transition-all duration-200 h-full min-h-10 bg-primary/20 border-primary/50 hover:bg-primary/30 text-primary"
            onClick={() => setIsAllTagsDialogOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="text-sm font-medium leading-tight text-center mt-0.5">
              All Tags
            </span>
          </button>
        )}
      </div>
      
      <AllTagsDialog
        isOpen={isAllTagsDialogOpen}
        onOpenChange={setIsAllTagsDialogOpen}
        allTagsData={allTagsData}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
      />
    </div>
  );
}