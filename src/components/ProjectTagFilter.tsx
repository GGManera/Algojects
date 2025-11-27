"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Tag, LayoutGrid } from 'lucide-react';
import { CollapsibleContent } from './CollapsibleContent';
import { cn } from '@/lib/utils';
import { Project, ProjectsData } from '@/types/social';
import { ProjectDetailsEntry } from '../../api/project-details';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // 1. Extract all unique tags and count projects for each
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

  const selectedCount = selectedTags.size;

  return (
    <Card className="w-full max-w-3xl mx-auto mb-8 bg-card border-primary/50">
      <CardHeader 
        className="flex flex-row items-center justify-between space-y-0 p-4 cursor-pointer"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <CardTitle className="text-lg flex items-center gap-2 gradient-text">
          <Tag className="h-5 w-5" /> Filter by Tags
        </CardTitle>
        <div className="flex items-center space-x-2">
          {selectedCount > 0 && (
            <span className="text-sm font-semibold text-muted-foreground">
              {selectedCount} selected
            </span>
          )}
          {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </CardHeader>
      
      <CollapsibleContent isOpen={isOpen}>
        <CardContent className="pt-0 pb-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : allTagsData.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tags found across all projects.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Select one or more tags to filter the project list.</p>
                {selectedCount > 0 && (
                  <Button variant="link" size="sm" onClick={handleClearAll} className="p-0 h-auto text-destructive">
                    Clear All ({selectedCount})
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allTagsData.map(({ tag, count }) => {
                  const isSelected = selectedTags.has(tag);
                  return (
                    <button 
                      key={tag} 
                      type="button"
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-200",
                        "bg-muted/30 border-muted hover:bg-muted/50",
                        isSelected ? "focus-glow-border !border-border-accent-green" : ""
                      )}
                      onClick={() => handleTagToggle(tag)}
                    >
                      <span className="text-sm font-medium capitalize">
                        {tag}
                      </span>
                      <span className="font-numeric text-xs text-muted-foreground flex items-center gap-1">
                        <LayoutGrid className="h-3 w-3" /> {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </CollapsibleContent>
    </Card>
  );
}