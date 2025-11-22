"use client";

import React, { useCallback } from 'react';
import { MetadataItem } from '@/types/project';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

interface MetadataItemEditorProps {
  item: MetadataItem;
  index: number;
  onUpdate: (index: number, field: keyof MetadataItem, value: string) => void;
  onUpdateType: (index: number, type: MetadataItem['type']) => void;
  onRemove: (index: number) => void;
  disabled: boolean;
}

export function MetadataItemEditor({ item, index, onUpdate, onUpdateType, onRemove, disabled }: MetadataItemEditorProps) {
  const handleUpdate = useCallback((field: keyof MetadataItem, value: string) => {
    onUpdate(index, field, value);
  }, [index, onUpdate]);

  const handleUpdateType = useCallback((type: string) => {
    onUpdateType(index, type as MetadataItem['type']);
  }, [index, onUpdateType]);

  // Ensure the value is always a string and defaults to 'text'
  const selectedType = item.type || 'text';

  return (
    <div className="flex flex-col sm:flex-row items-end gap-2 p-3 border rounded-md bg-card/50">
      <div className="flex-1 space-y-1 w-full">
        <Label htmlFor={`metadata-title-${index}`} className="text-sm font-medium">Title</Label>
        <Input
          id={`metadata-title-${index}`}
          placeholder="e.g., Website, X Profile"
          value={item.title}
          onChange={(e) => handleUpdate('title', e.target.value)}
          disabled={disabled}
          className="bg-muted/50"
        />
      </div>
      <div className="flex-1 space-y-1 w-full">
        <Label htmlFor={`metadata-value-${index}`} className="text-sm font-medium">Value</Label>
        <Input
          id={`metadata-value-${index}`}
          placeholder="e.g., https://example.com, @handle, 12345"
          value={item.value}
          onChange={(e) => handleUpdate('value', e.target.value)}
          disabled={disabled}
          className="bg-muted/50"
        />
      </div>
      <div className="w-full sm:w-[150px] space-y-1">
        <Label htmlFor={`metadata-type-${index}`} className="text-sm font-medium">Type</Label>
        <Select
          value={selectedType} // Use the guaranteed string value
          onValueChange={handleUpdateType}
          disabled={disabled}
        >
          <SelectTrigger id={`metadata-type-${index}`} className="bg-muted/50">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="url">URL</SelectItem>
            <SelectItem value="x-url">X (Twitter) URL</SelectItem>
            <SelectItem value="asset-id">Asset ID</SelectItem>
            <SelectItem value="address">Address</SelectItem>
            <SelectItem value="project-wallet">Project Wallet</SelectItem>
            <SelectItem value="asset-unit-name">Asset Unit Name</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        disabled={disabled}
        className="text-destructive hover:text-destructive/90 flex-shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}