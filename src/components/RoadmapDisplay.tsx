"use client";

import React, { useMemo, useState } from 'react';
import { RoadmapItem, RoadmapStatus } from '@/types/project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckCircle, Clock, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CollapsibleContent } from './CollapsibleContent';
import { Separator } from '@/components/ui/separator';

interface RoadmapDisplayProps {
  roadmapJson: string;
}

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
      }));
    }
  } catch (e) {
    // console.warn("Failed to parse roadmap JSON:", e);
  }
  return [];
};

// Helper to sort items: first by status (in-progress, future, done), then by quarter, then by order
const sortRoadmapItems = (items: RoadmapItem[]): RoadmapItem[] => {
  const statusOrder: Record<RoadmapStatus, number> = {
    'in-progress': 1,
    'future': 2,
    'done': 3,
  };

  // Simple quarter parser (Q1 2025 -> 2025.1)
  const parseQuarter = (quarter: string): number => {
    const match = quarter.match(/Q(\d)\s*(\d{4})/i);
    if (match) {
      const q = parseInt(match[1]);
      const year = parseInt(match[2]);
      return year + (q / 10); // e.g., 2025.1, 2025.2, etc.
    }
    return Infinity; // Put unparseable quarters last
  };

  return items.sort((a, b) => {
    // 1. Sort by Status
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;

    // 2. Sort by Quarter (Ascending for in-progress/future, Descending for done)
    const quarterA = parseQuarter(a.quarter);
    const quarterB = parseQuarter(b.quarter);
    
    if (a.status === 'done') {
        // Sort 'done' items by quarter descending (most recent done first)
        const quarterDiff = quarterB - quarterA;
        if (quarterDiff !== 0) return quarterDiff;
    } else {
        // Sort 'in-progress' and 'future' items by quarter ascending (chronological)
        const quarterDiff = quarterA - quarterB;
        if (quarterDiff !== 0) return quarterDiff;
    }

    // 3. Sort by Order (Ascending)
    return a.order - b.order;
  });
};

const RoadmapItemCard = ({ item }: { item: RoadmapItem }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    let icon: React.ReactNode;
    let colorClass: string;
    let titleClass: string;

    switch (item.status) {
        case 'done':
            icon = <CheckCircle className="h-5 w-5 text-green-400" />;
            colorClass = "border-green-400/50 bg-green-900/20";
            titleClass = "text-green-400 line-through";
            break;
        case 'in-progress':
            icon = <TrendingUp className="h-5 w-5 text-hodl-blue" />;
            colorClass = "border-hodl-blue/50 bg-hodl-blue/20";
            titleClass = "text-hodl-blue";
            break;
        case 'future':
        default:
            icon = <Clock className="h-5 w-5 text-muted-foreground" />;
            colorClass = "border-muted/50 bg-muted/20";
            titleClass = "text-foreground";
            break;
    }

    return (
        <div 
            className={cn("border rounded-lg transition-all duration-200", colorClass)}
        >
            <div 
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => setIsExpanded(prev => !prev)}
            >
                <div className="flex items-center space-x-3 min-w-0">
                    {icon}
                    <span className={cn("font-semibold truncate", titleClass)}>
                        {item.title}
                    </span>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-sm font-mono text-muted-foreground">{item.quarter}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
            </div>
            <CollapsibleContent isOpen={isExpanded}>
                <div className="p-3 pt-0 text-sm text-muted-foreground">
                    <Separator className="mb-2 bg-muted-foreground/20" />
                    <p className="whitespace-pre-wrap">{item.description}</p>
                </div>
            </CollapsibleContent>
        </div>
    );
};

export function RoadmapDisplay({ roadmapJson }: RoadmapDisplayProps) {
  const allItems = useMemo(() => parseRoadmap(roadmapJson), [roadmapJson]);
  const sortedItems = useMemo(() => sortRoadmapItems(allItems), [allItems]);

  const groupedItems = useMemo(() => {
    return sortedItems.reduce((acc, item) => {
      if (!acc[item.status]) {
        acc[item.status] = [];
      }
      acc[item.status].push(item);
      return acc;
    }, {} as Record<RoadmapStatus, RoadmapItem[]>);
  }, [sortedItems]);

  if (allItems.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-4 text-sm">
        No roadmap items defined yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* In Progress Section */}
      {groupedItems['in-progress'] && groupedItems['in-progress'].length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xl font-bold text-hodl-blue flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> In Progress
          </h4>
          {groupedItems['in-progress'].map(item => (
            <RoadmapItemCard key={item.id} item={item} />
          ))}
        </section>
      )}

      {/* Future Section */}
      {groupedItems['future'] && groupedItems['future'].length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6" /> Future Perspectives
          </h4>
          {groupedItems['future'].map(item => (
            <RoadmapItemCard key={item.id} item={item} />
          ))}
        </section>
      )}

      {/* Done Section */}
      {groupedItems['done'] && groupedItems['done'].length > 0 && (
        <section className="space-y-3">
          <h4 className="text-xl font-bold text-green-400 flex items-center gap-2">
            <CheckCircle className="h-6 w-6" /> Done
          </h4>
          {groupedItems['done'].map(item => (
            <RoadmapItemCard key={item.id} item={item} />
          ))}
        </section>
      )}
    </div>
  );
}