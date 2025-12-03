"use client";

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Tag, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagData {
  tag: string;
  count: number;
}

interface AllTagsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  allTagsData: TagData[];
  selectedTags: Set<string>;
  onTagToggle: (tag: string) => void;
}

export function AllTagsDialog({ isOpen, onOpenChange, allTagsData, selectedTags, onTagToggle }: AllTagsDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTags = useMemo(() => {
    if (!searchTerm) return allTagsData;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allTagsData.filter(data => data.tag.toLowerCase().includes(lowerSearchTerm));
  }, [allTagsData, searchTerm]);

  const handleClearSearch = useCallback(() => setSearchTerm(''), []);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card text-foreground p-4">
        <DialogHeader>
          <DialogTitle className="gradient-text flex items-center gap-2">
            <Tag className="h-5 w-5" /> All Available Tags
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted/50"
          />
        </div>

        <ScrollArea className="h-[300px] pr-4">
          <div className="grid grid-cols-1 gap-3">
            {filteredTags.length > 0 ? (
              filteredTags.map(({ tag, count }) => {
                // FIX 1: Check against the lowercase version of the tag for selection status
                const isSelected = selectedTags.has(tag.toLowerCase());
                
                return (
                  <div 
                    key={tag} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-200",
                      "bg-muted/30 border-muted hover:bg-muted/50",
                      // FIX 2: Apply focus-glow-border and ensure border is visible when selected
                      isSelected ? "focus-glow-border !border-border-accent-green" : "border-muted"
                    )}
                    onClick={() => onTagToggle(tag)}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Checkbox is now visually part of the row, but still controls state */}
                      <Checkbox
                        id={`tag-${tag}`}
                        checked={isSelected}
                        // Use onCheckedChange to handle the toggle action
                        onCheckedChange={() => onTagToggle(tag)}
                        className="border-muted-foreground"
                      />
                      <Label 
                        htmlFor={`tag-${tag}`} 
                        className="text-sm font-medium capitalize cursor-pointer flex-1"
                      >
                        {tag}
                      </Label>
                    </div>
                    <span className="font-numeric text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                      <LayoutGrid className="h-3 w-3" /> {count}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-muted-foreground text-center py-8">No tags found matching "{searchTerm}".</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}