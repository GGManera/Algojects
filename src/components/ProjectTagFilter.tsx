"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Tag, LayoutGrid, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectsData } from '@/types/social';
import { ProjectDetailsEntry } from '../../api/project-details';
import { AllTagsDialog } from './AllTagsDialog'; // Import the new dialog
import { Skeleton } from './ui/skeleton';

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
    <div className="w-full max-w-3xl mx-auto">
      {selectedCount > 0 && (
        <div className="flex justify-between items-center mb-4 p-2 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground">
            Filtering by <span className="font-semibold text-primary">{selectedCount} tag(s)</span>.
          </p>
          <Button variant="link" size="sm" onClick={handleClearAll} className="p-0 h-auto text-destructive">
            Clear All
          </Button>
        </div>
      )}
      
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