"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { RoadmapEditor } from './RoadmapEditor';
import { MetadataItem } from '@/types/project';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoadmapSuggestionEditorProps {
  initialItem: MetadataItem; // Must be type 'roadmap-data'
  onUpdateValue: (newValue: string) => void;
  disabled: boolean;
}

export function RoadmapSuggestionEditor({ initialItem, onUpdateValue, disabled }: RoadmapSuggestionEditorProps) {
  const initialRoadmapJson = initialItem.value || '[]';
  
  // State to hold the current roadmap JSON string being edited
  const [currentRoadmapJson, setCurrentRoadmapJson] = useState(initialRoadmapJson);
  
  // Sync internal state to parent handler
  useEffect(() => {
    onUpdateValue(currentRoadmapJson);
  }, [currentRoadmapJson, onUpdateValue]);

  return (
    <div className="space-y-4">
      <Alert className="bg-muted/50 border-hodl-blue text-muted-foreground">
        <Calendar className="h-4 w-4 text-hodl-blue" />
        <AlertTitle className="text-hodl-blue">Roadmap Editor</AlertTitle>
        <AlertDescription>
          Edit the roadmap items below. The entire resulting JSON structure will be submitted as your suggested change for the 'Roadmap' field.
        </AlertDescription>
      </Alert>
      
      <RoadmapEditor
        initialRoadmapJson={initialRoadmapJson}
        onRoadmapChange={setCurrentRoadmapJson}
        disabled={disabled}
      />
    </div>
  );
}