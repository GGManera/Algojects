"use client";

import React, { useState, useMemo } from 'react';
import { ProjectMetadata, MetadataItem } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Edit, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollapsibleContent } from './CollapsibleContent';

interface MetadataSuggestionSelectorProps {
  initialMetadata: ProjectMetadata;
  onSelectEdit: (item: MetadataItem) => void;
  onSelectNew: () => void;
  disabled: boolean;
}

export function MetadataSuggestionSelector({ initialMetadata, onSelectEdit, onSelectNew, disabled }: MetadataSuggestionSelectorProps) {
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [isEditExistingOpen, setIsEditExistingOpen] = useState(false);

  // Filter out internal/fixed metadata items that shouldn't be edited by suggestion
  const editableMetadata = useMemo(() => {
    const excludedTypes = new Set([
      'project-name', 'project-description', 'whitelisted-editors', 'is-creator-added', 'added-by-address', 'is-community-notes', 'tags', 'is-claimed', 'project-wallet'
    ]);
    
    return initialMetadata
      .filter(item => !excludedTypes.has(item.type || ''))
      .map((item, index) => ({
        ...item,
        // Create a unique key for the selector
        key: `${item.title}-${item.type}-${index}`,
      }));
  }, [initialMetadata]);

  const handleEditExisting = () => {
    if (selectedItemKey) {
      const selectedItem = editableMetadata.find(item => item.key === selectedItemKey);
      if (selectedItem) {
        // Pass a clean copy of the item (without the temporary 'key')
        const { key, ...cleanItem } = selectedItem;
        onSelectEdit(cleanItem);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Alert className="bg-muted/50 border-hodl-blue text-muted-foreground">
        <Edit className="h-4 w-4 text-hodl-blue" />
        <AlertTitle className="text-hodl-blue">Suggest Metadata Changes</AlertTitle>
        <AlertDescription>
          Choose whether to suggest an edit to an existing field or add a new one.
        </AlertDescription>
      </Alert>

      {/* Option 1: Edit Existing Metadata */}
      <div className="border rounded-lg p-4 space-y-3 bg-card/50">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsEditExistingOpen(prev => !prev)}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" /> Edit Existing Field
          </h3>
          {isEditExistingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        
        <CollapsibleContent isOpen={isEditExistingOpen}>
          <div className="space-y-3 pt-2">
            <Select
              value={selectedItemKey || undefined}
              onValueChange={setSelectedItemKey}
              disabled={disabled || editableMetadata.length === 0}
            >
              <SelectTrigger className="w-full bg-muted/50">
                <SelectValue placeholder={editableMetadata.length > 0 ? "Select Metadata Item to Edit" : "No editable metadata found"} />
              </SelectTrigger>
              <SelectContent>
                {editableMetadata.map(item => (
                  <SelectItem key={item.key} value={item.key}>
                    {item.title} ({item.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleEditExisting} 
              disabled={disabled || !selectedItemKey} 
              className="w-full"
            >
              <Edit className="h-4 w-4 mr-2" /> Suggest Edit
            </Button>
          </div>
        </CollapsibleContent>
      </div>

      {/* Option 2: Add New Metadata */}
      <div className="border rounded-lg p-4 space-y-3 bg-card/50">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-primary" /> Add New Field
        </h3>
        <Button 
          onClick={onSelectNew} 
          disabled={disabled} 
          className="w-full"
        >
          Start New Suggestion
        </Button>
      </div>
    </div>
  );
}