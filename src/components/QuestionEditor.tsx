"use client";

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown, PlusCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollapsibleContent } from './CollapsibleContent';

interface Option {
  id: string;
  label: string;
}

interface Question {
  id: string;
  type: 'rating' | 'text' | 'single_choice';
  question: string;
  scale?: number;
  options?: Option[]; // Updated type to Option[]
  required: boolean;
  depends_on?: string;
  condition?: string;
}

interface QuestionEditorProps {
  question: Question;
  index: number;
  onUpdate: (index: number, updatedQuestion: Question) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void; // NEW
  onMoveDown: (index: number) => void; // NEW
  onAddBelow: (index: number) => void; // NEW
  moduleId: string;
  isFirst: boolean; // NEW
  isLast: boolean; // NEW
}

export function QuestionEditor({ question, index, onUpdate, onRemove, onMoveUp, onMoveDown, onAddBelow, moduleId, isFirst, isLast }: QuestionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleUpdate = (field: keyof Question, value: any) => {
    const updatedQuestion = { ...question, [field]: value };
    onUpdate(index, updatedQuestion);
  };

  const handleUpdateOptions = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const lines = e.target.value.split('\n');
    const options: Option[] = [];
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        const parts = trimmedLine.split(':').map(p => p.trim());
        if (parts.length >= 2) {
          // Format: ID: Label
          options.push({ id: parts[0], label: parts.slice(1).join(':').trim() });
        } else {
          // Fallback if no colon is found: use the whole line as both ID and Label
          options.push({ id: trimmedLine.toLowerCase().replace(/\s/g, '_'), label: trimmedLine });
        }
      }
    });
    handleUpdate('options', options);
  };
  
  // Helper to convert Option[] back to string for Textarea display
  const optionsToString = (options: Option[] | undefined): string => {
    if (!options) return '';
    return options.map(opt => `${opt.id}: ${opt.label}`).join('\n');
  };

  return (
    <div className="border p-3 rounded-md bg-muted/50 space-y-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(prev => !prev)}>
        <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {index + 1}. {question.question || `[${question.type.toUpperCase()}]`}
        </h5>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onMoveUp(index); }}
            disabled={isFirst}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            aria-label="Move question up"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onMoveDown(index); }}
            disabled={isLast}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            aria-label="Move question down"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemove(index); }} className="h-6 w-6 text-destructive hover:text-destructive/90" aria-label="Remove question">
            <Trash2 className="h-3 w-3" />
          </Button>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      <CollapsibleContent isOpen={isExpanded}>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`q-type-${question.id}`}>Type</Label>
              <Select
                value={question.type}
                onValueChange={(value: Question['type']) => handleUpdate('type', value)}
              >
                <SelectTrigger id={`q-type-${question.id}`} className="bg-card">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="single_choice">Single Choice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`q-id-${question.id}`}>ID (Unique)</Label>
              <Input
                id={`q-id-${question.id}`}
                value={question.id}
                onChange={(e) => handleUpdate('id', e.target.value)}
                className="bg-card font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`q-question-${question.id}`}>Question Text</Label>
            <Textarea
              id={`q-question-${question.id}`}
              value={question.question}
              onChange={(e) => handleUpdate('question', e.target.value)}
              className="bg-card"
            />
          </div>

          {question.type === 'rating' && (
            <div className="space-y-2">
              <Label htmlFor={`q-scale-${question.id}`}>Scale (Max Rating)</Label>
              <Input
                id={`q-scale-${question.id}`}
                type="number"
                min={1}
                value={question.scale || 5}
                onChange={(e) => handleUpdate('scale', parseInt(e.target.value) || 1)}
                className="bg-card"
              />
            </div>
          )}

          {question.type === 'single_choice' && (
            <div className="space-y-2">
              <Label htmlFor={`q-options-${question.id}`}>Options (ID: Label, one per line)</Label>
              <Textarea
                id={`q-options-${question.id}`}
                value={optionsToString(question.options)}
                onChange={handleUpdateOptions}
                className="bg-card"
                placeholder="yes: Yes&#10;no: No&#10;maybe: Maybe"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id={`q-required-${question.id}`}
              checked={question.required}
              onCheckedChange={(checked) => handleUpdate('required', !!checked)}
            />
            <Label htmlFor={`q-required-${question.id}`}>Required</Label>
          </div>

          <h6 className="text-sm font-semibold pt-2">Dependencies (Optional)</h6>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`q-depends-on-${question.id}`}>Depends On Question ID</Label>
              <Input
                id={`q-depends-on-${question.id}`}
                value={question.depends_on || ''}
                onChange={(e) => handleUpdate('depends_on', e.target.value || undefined)}
                className="bg-card font-mono text-xs"
                placeholder="e.g., navigation_continuity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`q-condition-${question.id}`}>Condition Value (Option ID)</Label>
              <Input
                id={`q-condition-${question.id}`}
                value={question.condition || ''}
                onChange={(e) => handleUpdate('condition', e.target.value || undefined)}
                className="bg-card"
                placeholder="e.g., no"
              />
            </div>
          </div>
          <Button onClick={() => onAddBelow(index)} className="w-full mt-4" variant="outline">
            <PlusCircle className="h-4 w-4 mr-2" /> Add Question Below
          </Button>
        </div>
      </CollapsibleContent>
    </div>
  );
}