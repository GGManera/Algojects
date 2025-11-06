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
import { ChevronDown, ChevronUp, Info, Star, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RatingInput } from './RatingInput';
import { SingleChoiceCardGroup } from './SingleChoiceCardGroup';
import { useFeedbackLanguage } from '@/contexts/FeedbackLanguageContext'; // Import language context
import { QuestionRenderer } from './QuestionRenderer'; // Import QuestionRenderer
import { Separator } from '@/components/ui/separator'; // Import Separator

interface DynamicFeedbackFormProps {
  schema: FormStructure;
  isEditing: boolean;
  setIsSubmitting: (isSubmitting: boolean) => void; // NEW PROP
}

export function DynamicFeedbackForm({ schema, isEditing, setIsSubmitting }: DynamicFeedbackFormProps) {
  const { activeAddress } = useWallet();
  const { language } = useFeedbackLanguage(); // Get selected language
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false); // Local state for button/form disabling
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
  const [openModules, setOpenModules] = useState<Set<string>>(() => initialOpenModules);

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
    setIsLocalSubmitting(true);
    setIsSubmitting(true); // Notify parent
    setValidationErrors({}); // Clear previous errors

    const newErrors: Record<string, boolean> = {};
    let firstUnansweredRequiredQuestionId: string | null = null;

    // Validate all visible required questions
    for (const question of visibleQuestions) {
      // Skip validation if the module is under construction
      const module = filteredModules.find(m => m.id === question.moduleId);
      if (module?.is_under_construction) continue;

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
      setIsLocalSubmitting(false);
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
      
      // Pass the selected language to the submission API
      await submitFormResponse(submissionData, language);
      
      dismissToast(toastId);
      showSuccess("Thank you! Your feedback has been recorded.");
      setResponses({}); // Clear form
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "Failed to submit feedback.");
    } finally {
      setIsLocalSubmitting(false);
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

  // --- NEW: Minicard Content Logic ---
  const submitButtonText = language === 'pt' ? "Enviar" : "Submit Feedback";
  const explainerTitle = language === 'pt' ? "Modo Explorador" : "Explorer Mode";
  const explainerText = language === 'pt' 
    ? "Você pode navegar pelos projetos sem conectar sua carteira. Para interagir com o protocolo (postar uma Avaliação, Comentário, Resposta ou Curtir postagens), você precisa conectar uma carteira .algo."
    : "You can browse projects without connecting your wallet. To interact with the protocol (post a Review, Comment, Reply, or Like posts), you need to connect a .algo wallet.";
  const explainerLinkText = language === 'pt' 
    ? "*você pode obter e configurar seu domínio .algo em NFDomains"
    : "*you can get and set your .algo domain to your wallet at NFDomains";
  const explainerLinkUrl = "https://app.nf.domains";
  // --- END NEW ---

  return (
    <Card className="w-full max-w-3xl mx-auto mt-8 bg-card">
      <CardHeader>
        <CardTitle className="gradient-text">AlgoJects Feedback Form - V.{schema.version}</CardTitle>
        {/* REMOVED: <CardDescription>{schema.metadata.description}</CardDescription> */}
      </CardHeader>
      <CardContent>
        {!isUserConnected && (
          <Alert className="w-full max-w-3xl bg-muted/50 border-hodl-blue text-muted-foreground mb-6">
            <Info className="h-4 w-4 text-hodl-blue" />
            <AlertTitle className="text-hodl-blue">{explainerTitle}</AlertTitle>
            <AlertDescription>
              {explainerText}
              <p className="text-xs italic mt-1">
                <a href={explainerLinkUrl} target="_blank" rel="noopener noreferrer" className="text-hodl-blue hover:underline">
                  {explainerLinkText}
                </a>
              </p>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {(filteredModules || []).map(module => {
            const moduleQuestions = allQuestions.filter(q => q.moduleId === module.id);
            const isOpen = openModules.has(module.id);
            const isUnderConstruction = !!module.is_under_construction;

            return (
              <div key={module.id} className="space-y-4 p-4 border border-muted rounded-lg bg-muted/20">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleModule(module.id)}>
                    <h3 className="text-xl font-semibold text-primary">{module.title}</h3>
                    {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                <p className="text-sm text-muted-foreground">{module.description}</p>
                
                <CollapsibleContent isOpen={isOpen}>
                    {isUnderConstruction ? (
                        <Alert className="w-full bg-red-500/20 border-red-500 text-red-400">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <AlertTitle className="text-red-400">Under Construction</AlertTitle>
                            <AlertDescription>This module is currently under construction and its content is not available.</AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            {moduleQuestions.map((question, index) => {
                                const isVisible = visibleQuestions.some(q => q.id === question.id);
                                
                                if (!isVisible) return null;
                                
                                // Increment visible index only if the question is visible
                                const currentQuestionNumber = moduleQuestions.filter((_, i) => i <= index).filter(q => visibleQuestions.some(vq => vq.id === q.id)).length;

                                return (
                                    <div key={question.id} className="pt-2">
                                        {currentQuestionNumber > 1 && (
                                            <Separator className="my-4 bg-muted-foreground/20" />
                                        )}
                                        <div className="flex items-baseline space-x-2"> {/* Changed items-start to items-baseline */}
                                            <Label className="text-base font-bold text-foreground">
                                                {currentQuestionNumber}.
                                            </Label>
                                            <div className="flex-1 space-y-2"> {/* Wrapper for QuestionRenderer content */}
                                                <QuestionRenderer
                                                    ref={el => { if (el) questionRefs.current.set(question.id, el); else questionRefs.current.delete(question.id); }}
                                                    question={question}
                                                    value={responses[question.id]}
                                                    onChange={(value) => handleResponseChange(question.id, value)}
                                                    isInvalid={validationErrors[question.id]}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </CollapsibleContent>
              </div>
            );
          })}
          
          <Button type="submit" disabled={isLocalSubmitting} className="w-full">
            {isLocalSubmitting ? (language === 'pt' ? "Enviando..." : "Submitting...") : submitButtonText}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}