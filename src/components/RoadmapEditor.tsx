"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RoadmapItem, RoadmapStatus } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Calendar, Hash } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollapsibleContent } from './CollapsibleContent';
import { cn } from '@/lib/utils';

interface RoadmapEditorProps {
  initialRoadmapJson: string;
  onRoadmapChange: (jsonString: string) => void;
  disabled: boolean;
}

const STATUS_OPTIONS: { value: RoadmapStatus; label: string }[] = [
  { value: 'in-progress', label: 'In Progress' },
  { value: 'future', label: 'Future Perspective' },
  { value: 'done', label: 'Done' },
];

// Utility to parse JSON string into RoadmapItem[]
const parseRoadmap = (jsonString: string): RoadmapItem[] => {
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) {
      return parsed.map(item => ({
        id: item.id || `r${Date.now()}`,
        title: item.title || '',
        description: item.description || '',
        status: item.status || 'future',
        quarter: item.quarter || '',
        order: item.order || 0,
      })).sort((a, b) => a.order - b.order);
    }
  } catch (e) {
    console.warn("Failed to parse roadmap JSON:", e);
  }
  return [];
};

export function RoadmapEditor({ initialRoadmapJson, onRoadmapChange, disabled }: RoadmapEditorProps) {
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>(() => parseRoadmap(initialRoadmapJson));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sync internal state to external prop when initialJson changes (e.g., on load)
  useEffect(() => {
    setRoadmapItems(parseRoadmap(initialRoadmapJson));
  }, [initialRoadmapJson]);

  // Sync external change function when internal state changes
  useEffect(() => {
    // Serialize and call parent handler
    const jsonString = JSON.stringify(roadmapItems);
    onRoadmapChange(jsonString);
  }, [roadmapItems, onRoadmapChange]);

  const handleUpdateItem = useCallback((id: string, field: keyof RoadmapItem, value: any) => {
    setRoadmapItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  }, []);

  const handleAddItem = useCallback(() => {
    const newItem: RoadmapItem = {
      id: `r${Date.now()}`,
      title: '',
      description: '',
      status: 'future',
      quarter: 'Q1 2026',
      order: roadmapItems.length > 0 ? Math.max(...roadmapItems.map(i => i.order)) + 1 : 0,
    };
    setRoadmapItems(prev => [...prev, newItem]);
    setExpandedId(newItem.id);
  }, [roadmapItems]);

  const handleRemoveItem = useCallback((id: string) => {
    setRoadmapItems(prev => prev.filter(item => item.id !== id));
    if (expandedId === id) setExpandedId(null);
  }, [expandedId]);

  const handleMoveItem = useCallback((id: string, direction: 'up' | 'down') => {
    setRoadmapItems(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index === -1) return prev;

      const newItems = [...prev];
      const item = newItems[index];
      
      // Simple swap logic based on current visual order
      if (direction === 'up' && index > 0) {
        [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      } else if (direction === 'down' && index < newItems.length - 1) {
        [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
      }
      
      // Re-assign order based on new array index for persistence
      return newItems.map((item, idx) => ({ ...item, order: idx }));
    });
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
        <Calendar className="h-5 w-5" /> Project Roadmap Items
      </h3>
      
      <div className="space-y-3">
        {roadmapItems.map((item, index) => {
          const isExpanded = expandedId === item.id;
          const isFirst = index === 0;
          const isLast = index === roadmapItems.length - 1;

          return (
            <div 
              key={item.id} 
              className={cn(
                "border rounded-lg bg-muted/30 transition-all duration-200",
                isExpanded ? "border-primary/50" : "border-muted"
              )}
            >
              <div 
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground w-4 text-center">{index + 1}.</span>
                  <span className={cn(
                    "font-semibold truncate",
                    item.status === 'done' && "line-through text-muted-foreground",
                    item.status === 'in-progress' && "text-hodl-blue",
                    item.status === 'future' && "text-foreground"
                  )}>
                    {item.title || "Untitled Roadmap Item"}
                  </span>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className="text-xs font-mono text-muted-foreground">{item.quarter}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); handleMoveItem(item.id, 'up'); }}
                    disabled={disabled || isFirst}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); handleMoveItem(item.id, 'down'); }}
                    disabled={disabled || isLast}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }} disabled={disabled} className="text-destructive hover:text-destructive/90" aria-label="Remove item">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              <CollapsibleContent isOpen={isExpanded}>
                <div className="space-y-3 p-3 pt-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor={`roadmap-title-${item.id}`}>Title</Label>
                      <Input
                        id={`roadmap-title-${item.id}`}
                        value={item.title}
                        onChange={(e) => handleUpdateItem(item.id, 'title', e.target.value)}
                        disabled={disabled}
                        className="bg-card"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`roadmap-quarter-${item.id}`}>Quarter (e.g., Q4 2025)</Label>
                      <Input
                        id={`roadmap-quarter-${item.id}`}
                        value={item.quarter}
                        onChange={(e) => handleUpdateItem(item.id, 'quarter', e.target.value)}
                        disabled={disabled}
                        className="bg-card"
                        placeholder="Q1 2026"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor={`roadmap-status-${item.id}`}>Status</Label>
                      <Select
                        value={item.status}
                        onValueChange={(value: RoadmapStatus) => handleUpdateItem(item.id, 'status', value)}
                        disabled={disabled}
                      >
                        <SelectTrigger id={`roadmap-status-${item.id}`} className="bg-card">
                          <SelectValue placeholder="Select Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`roadmap-order-${item.id}`}>Order (Manual Sort)</Label>
                      <Input
                        id={`roadmap-order-${item.id}`}
                        type="number"
                        value={item.order}
                        onChange={(e) => handleUpdateItem(item.id, 'order', parseInt(e.target.value) || 0)}
                        disabled={disabled}
                        className="bg-card"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`roadmap-description-${item.id}`}>Description</Label>
                    <Textarea
                      id={`roadmap-description-${item.id}`}
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                      disabled={disabled}
                      className="bg-card min-h-[80px]"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          );
        })}
      </div>

      <Button onClick={handleAddItem} className="w-full" disabled={disabled}>
        <PlusCircle className="h-4 w-4 mr-2" /> Add Roadmap Item
      </Button>
    </div>
  );
}