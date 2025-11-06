"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
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
import { CollapsibleContent } from './CollapsibleContent';
import { ChevronDown, ChevronUp, Info, Star } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RatingInput } from './RatingInput';
import { SingleChoiceCardGroup } from './SingleChoiceCardGroup';

interface DynamicFeedbackFormProps {
  schema: FormStructure;
  isEditing: boolean;
}

// Placeholder component for rendering individual questions
const QuestionRenderer = React.forwardRef<HTMLDivElement, { question: any, value: any, onChange: (value: any) => void, isInvalid: boolean }>(({ question, value, onChange, isInvalid }, ref) => {
  const labelText = question.question + (question.required ? ' *' : ' (Optional)');
  
  // Define classes for invalid state
  const invalidClasses = isInvalid ? "border-red-500 ring-2 ring-red-500" : "border-muted";

  switch (question.type) {
    case 'rating':
      return (
        <div className="space-y-2" id={question.id}>
          <Label htmlFor={`question-${question.id}`}>{labelText}</Label>
          <RatingInput
            ref={ref}
            id={`question-${question.id}`}
            scale={question.scale || 5}
            value={value}
            onChange={onChange}
            className={invalidClasses} // Apply invalid classes to the container
          />
        </div>
      );
    case 'text':
      return (
        <div className="space-y-2" id={question.id}>
          <Label htmlFor={`question-${question.id}`}>{labelText}</Label>
          <Textarea
            ref={ref as React.Ref<HTMLTextAreaElement>} // Cast ref for textarea
            id={`question-${question.id}`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn("bg-muted/50 min-h-[80px]", invalidClasses)} // Apply invalid classes directly
          />
        </div>
      );
    case 'single_choice':
      return (
        <div className="space-y-2" id={question.id}>
          <Label htmlFor={`question-${question.id}`}>{labelText}</Label>
          <SingleChoiceCardGroup
            ref={ref}
            id={`question-${question.id}`}
            options={question.options || []}
            value={value || null}
            onChange={onChange}
            className={invalidClasses} // Apply invalid classes to the container
          />
        </div>
      );
    default:
      return <p className="text-red-500">Unsupported question type: {question.type}</p>;
  }
});

QuestionRenderer.displayName = "QuestionRenderer";

export function DynamicFeedbackForm({ schema, isEditing }: DynamicFeedbackFormProps) {
  const { activeAddress } = useWallet();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  
  const isUserConnected = !!activeAddress;
  const questionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Filter modules based on connection status
  const filteredModules = useMemo(() => {
    if (!schema.modules) return [];

    if (!isUserConnected && schema.rendering_rules?.unconnected_user?.show_modules) {
      const allowedModuleIds = new Set(schema.rendering_rules.unconnected_user.show_modules);
      return schema.modules.filter(module => allowedModuleIds.has(module.id));
    }
    // For connected users, or if no specific rules for unconnected, show all modules
    return schema.modules;
  }, [schema.modules, isUserConnected, schema.rendering_rules]);

  // Initialize openModules safely, now based on filteredModules
  const initialOpenModules = useMemo(() => new Set(filteredModules.map(m => m.id)), [filteredModules]);
  const [openModules, setOpenModules] = useState<Set<string>>(initialOpenModules);

  const allQuestions = useMemo(() => {
    return (filteredModules || []).flatMap(module => (module.questions || []).map((q: any) => ({ ...q, moduleId: module.id })));
  }, [filteredModules]);

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
    // Clear validation error for this question if it's now answered
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      if (value !== undefined && value !== null && (typeof value === 'string' ? value.trim() !== '' : true)) {
        delete newErrors[questionId];
      }
      return newErrors;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setValidationErrors({}); // Clear previous errors

    const newErrors: Record<string, boolean> = {};
    let firstUnansweredRequiredQuestionId: string | null = null;

    // Validate all visible required questions
    for (const question of visibleQuestions) {
      if (question.required) {
        const answer = responses[question.id];
        const isAnswerEmpty = (answer === undefined || answer === null || (typeof answer === 'string' && answer.trim() === ''));
        
        if (isAnswerEmpty) {
          newErrors[question.id] = true;
          if (!firstUnansweredRequiredQuestionId) {
            firstUnansweredRequiredQuestionId = question.id;
          }
        }
      }
    }

    setValidationErrors(newErrors);

    if (firstUnansweredRequiredQuestionId) {
      showError("Please answer all required questions.");
      // Scroll to the first unanswered required question
      const element = questionRefs.current.get(firstUnansweredRequiredQuestionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setIsSubmitting(false);
      return;
    }

    const toastId = showLoading("Submitting your feedback...");

    try {
      const submissionData = {
        form_id: schema.form_id,
        version: schema.version,
        feedback_version: schema.feedback_version,
        wallet_address: activeAddress || 'unconnected',
        responses: responses,
      };
      
      console.log("[DynamicFeedbackForm] Submitting data:", submissionData);
      
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

  const unconnectedExplainer = schema.rendering_rules?.unconnected_user?.explainers?.investor_mode;

  return (
    <Card className="w-full max-w-3xl mx-auto mt-8 bg-card">
      <CardHeader>
        <CardTitle className="gradient-text">AlgoJects Feedback Form - V.{schema.version}</CardTitle>
        <CardDescription>{schema.metadata.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!isUserConnected && unconnectedExplainer && (
          <Alert className="w-full max-w-3xl bg-muted/50 border-hodl-blue text-muted-foreground mb-6">
            <Info className="h-4 w-4 text-hodl-blue" />
            <AlertTitle className="text-hodl-blue">Investor Mode</AlertTitle>
            <AlertDescription>{unconnectedExplainer}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {(filteredModules || []).map(module => {
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
                        ref={el => { if (el) questionRefs.current.set(question.id, el); else questionRefs.current.delete(question.id); }}
                        question={question}
                        value={responses[question.id]}
                        onChange={(value) => handleResponseChange(question.id, value)}
                        isInvalid={validationErrors[question.id]}
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