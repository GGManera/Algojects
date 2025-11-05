"use client";

import React, { useState, useMemo } from 'react';
import { FormStructure, submitFormResponse } from '@/lib/feedback-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWallet } from '@txnlab/use-wallet-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { CollapsibleContent } from './CollapsibleContent'; // Import CollapsibleContent
import { ChevronDown, ChevronUp } from 'lucide-react'; // IMPORT MISSING ICONS

interface DynamicFeedbackFormProps {
  schema: FormStructure;
  isEditing: boolean;
}

// Placeholder component for rendering individual questions
const QuestionRenderer = ({ question, value, onChange }: { question: any, value: any, onChange: (value: any) => void }) => {
  // Simple rendering logic based on question type
  switch (question.type) {
    case 'rating':
      return (
        <div className="space-y-2">
          <Label>{question.question} (Scale: 1-{question.scale})</Label>
          <Input
            type="number"
            min={1}
            max={question.scale}
            value={value || ''}
            onChange={(e) => onChange(parseInt(e.target.value) || null)}
            className="bg-muted/50"
          />
        </div>
      );
    case 'text':
      return (
        <div className="space-y-2">
          <Label>{question.question}</Label>
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="bg-muted/50 min-h-[80px]"
          />
        </div>
      );
    case 'single_choice':
      return (
        <div className="space-y-2">
          <Label>{question.question}</Label>
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className="bg-muted/50">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options.map((option: string) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    default:
      return <p className="text-red-500">Unsupported question type: {question.type}</p>;
  }
};

export function DynamicFeedbackForm({ schema, isEditing }: DynamicFeedbackFormProps) {
  const { activeAddress } = useWallet();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize openModules safely
  const initialOpenModules = useMemo(() => new Set((schema.modules || []).map(m => m.id)), [schema.modules]);
  const [openModules, setOpenModules] = useState<Set<string>>(initialOpenModules);

  const allQuestions = useMemo(() => {
    // Ensure schema.modules is an array before calling flatMap
    return (schema.modules || []).flatMap(module => (module.questions || []).map((q: any) => ({ ...q, moduleId: module.id })));
  }, [schema]);

  const visibleQuestions = useMemo(() => {
    return allQuestions.filter(q => {
      if (!q.depends_on) return true;
      
      const dependencyQuestion = allQuestions.find(aq => aq.id === q.depends_on);
      if (!dependencyQuestion) return true; // Should not happen if schema is valid

      const dependencyValue = responses[q.depends_on];
      return dependencyValue === q.condition;
    });
  }, [allQuestions, responses]);

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = showLoading("Submitting your feedback...");

    try {
      const submissionData = {
        form_id: schema.form_id,
        version: schema.version,
        feedback_version: schema.feedback_version,
        wallet_address: activeAddress || 'unconnected',
        responses: responses,
      };
      
      await submitFormResponse(submissionData);
      
      dismissToast(toastId);
      showSuccess("Thank you! Your feedback has been recorded.");
      setResponses({}); // Clear form
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "Failed to submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const toggleModule = (moduleId: string) => {
    setOpenModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  if (isEditing) {
    return (
      <Card className="w-full max-w-3xl mx-auto mt-8 bg-card border-primary/50">
        <CardHeader>
          <CardTitle className="gradient-text">Admin Mode Active</CardTitle>
          <CardDescription>Use the editor above to modify the form schema.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto mt-8 bg-card">
      <CardHeader>
        <CardTitle className="gradient-text">{schema.form_id} ({schema.feedback_version})</CardTitle>
        <CardDescription>{schema.metadata.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {(schema.modules || []).map(module => {
            const moduleQuestions = visibleQuestions.filter(q => q.moduleId === module.id);
            const isOpen = openModules.has(module.id);

            return (
              <div key={module.id} className="space-y-4 p-4 border border-muted rounded-lg bg-muted/20">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleModule(module.id)}>
                    <h3 className="text-xl font-semibold text-primary">{module.title}</h3>
                    {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                <p className="text-sm text-muted-foreground">{module.description}</p>
                
                <CollapsibleContent isOpen={isOpen}>
                    {moduleQuestions.map(question => (
                    <div key={question.id} className="pt-2">
                        <QuestionRenderer
                        question={question}
                        value={responses[question.id]}
                        onChange={(value) => handleResponseChange(question.id, value)}
                        />
                    </div>
                    ))}
                </CollapsibleContent>
              </div>
            );
          })}
          
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}