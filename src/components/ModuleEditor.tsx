"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { QuestionEditor } from './QuestionEditor';
import { cn } from '@/lib/utils';
import { CollapsibleContent } from './CollapsibleContent';

interface Module {
  id: string;
  title: string;
  description: string;
  questions: any[];
}

interface ModuleEditorProps {
  module: Module;
  index: number;
  onUpdate: (index: number, updatedModule: Module) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void; // NEW
  onMoveDown: (index: number) => void; // NEW
  isFirst: boolean; // NEW
  isLast: boolean; // NEW
}

export function ModuleEditor({ module, index, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: ModuleEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const questions = module.questions || [];

  const handleUpdateQuestion = (qIndex: number, updatedQuestion: any) => {
    const newQuestions = questions.map((q, i) => i === qIndex ? updatedQuestion : q);
    onUpdate(index, { ...module, questions: newQuestions });
  };

  const handleAddQuestion = () => {
    const newQuestion = {
      id: `q${Date.now()}`,
      type: 'text',
      question: 'New Question',
      required: false,
    };
    onUpdate(index, { ...module, questions: [...questions, newQuestion] });
  };

  const handleRemoveQuestion = (qIndex: number) => {
    const newQuestions = questions.filter((_, i) => i !== qIndex);
    onUpdate(index, { ...module, questions: newQuestions });
  };

  // NEW: Function to reorder questions within this module
  const handleMoveQuestionUp = (qIndex: number) => {
    if (qIndex === 0) return;
    const newQuestions = [...questions];
    const [movedQuestion] = newQuestions.splice(qIndex, 1);
    newQuestions.splice(qIndex - 1, 0, movedQuestion);
    onUpdate(index, { ...module, questions: newQuestions });
  };

  // NEW: Function to reorder questions within this module
  const handleMoveQuestionDown = (qIndex: number) => {
    if (qIndex === questions.length - 1) return;
    const newQuestions = [...questions];
    const [movedQuestion] = newQuestions.splice(qIndex, 1);
    newQuestions.splice(qIndex + 1, 0, movedQuestion);
    onUpdate(index, { ...module, questions: newQuestions });
  };

  // NEW: Function to add a question below a specific index
  const handleAddQuestionBelow = (qIndex: number) => {
    const newQuestion = {
      id: `q${Date.now()}`,
      type: 'text',
      question: 'New Question',
      required: false,
    };
    const newQuestions = [...questions];
    newQuestions.splice(qIndex + 1, 0, newQuestion);
    onUpdate(index, { ...module, questions: newQuestions });
  };

  return (
    <Card className="bg-muted/30 border-l-4 border-primary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 cursor-pointer" onClick={() => setIsExpanded(prev => !prev)}>
        <CardTitle className="text-lg text-primary">{module.title}</CardTitle>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onMoveUp(index); }}
            disabled={isFirst}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Move module up"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onMoveDown(index); }}
            disabled={isLast}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Move module down"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemove(index); }} className="text-destructive hover:text-destructive/90" aria-label="Remove module">
            <Trash2 className="h-4 w-4" />
          </Button>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>
      
      <CollapsibleContent isOpen={isExpanded} className="p-4 pt-0">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`module-title-${index}`}>Title</Label>
            <Input
              id={`module-title-${index}`}
              value={module.title}
              onChange={(e) => onUpdate(index, { ...module, title: e.target.value })}
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`module-description-${index}`}>Description</Label>
            <Textarea
              id={`module-description-${index}`}
              value={module.description}
              onChange={(e) => onUpdate(index, { ...module, description: e.target.value })}
              className="bg-muted/50"
            />
          </div>
          
          <h4 className="text-md font-semibold pt-2">Questions ({questions.length})</h4>
          <div className="space-y-4 border p-3 rounded-md bg-card">
            {questions.map((question, qIndex) => (
              <QuestionEditor
                key={`${module.id}-${question.id}`} 
                question={question}
                index={qIndex}
                onUpdate={handleUpdateQuestion}
                onRemove={handleRemoveQuestion}
                onMoveUp={handleMoveQuestionUp} // NEW
                onMoveDown={handleMoveQuestionDown} // NEW
                onAddBelow={handleAddQuestionBelow} // NEW
                moduleId={module.id}
                isFirst={qIndex === 0} // NEW
                isLast={qIndex === questions.length - 1} // NEW
              />
            ))}
            <Button onClick={handleAddQuestion} className="w-full" variant="outline">
              <PlusCircle className="h-4 w-4 mr-2" /> Add New Question
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Card>
  );
}