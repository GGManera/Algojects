"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { fetchFormStructure, FormStructure, BilingualFormStructureResponse } from '@/lib/feedback-api';
import { DynamicFeedbackForm } from '@/components/DynamicFeedbackForm';
import { AdminFormEditor } from '@/components/AdminFormEditor';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Bug, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StickyHeader } from '@/components/StickyHeader';
import { useNavigate } from 'react-router-dom';
import { FeedbackLanguageProvider, useFeedbackLanguage } from '@/contexts/FeedbackLanguageContext'; // Import context
import { Label } from '@/components/ui/label'; // Import Label
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select components

// Componente interno para gerenciar o estado e renderizar o formulário
const FeedbackContent = ({ isSubmitting, setIsSubmitting }: { isSubmitting: boolean, setIsSubmitting: (isSubmitting: boolean) => void }) => { // Receive props
  const { activeAddress } = useWallet();
  const [bilingualSchema, setBilingualSchema] = useState<BilingualFormStructureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const { language } = useFeedbackLanguage(); // Use language context

  const adminWallet = import.meta.env.VITE_FEEDBACK_ADMIN_WALLET;

  const isAuthorized = useMemo(() => {
    return activeAddress === adminWallet;
  }, [activeAddress, adminWallet]);

  const fetchSchema = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedSchema = await fetchFormStructure();
      setBilingualSchema(fetchedSchema);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load form schema.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchema();
  }, [refetchTrigger]);

  const handleSchemaUpdate = () => {
    setRefetchTrigger(prev => prev + 1);
  };
  
  // Determine the currently active schema based on language
  const activeSchema: FormStructure | undefined = useMemo(() => {
    if (!bilingualSchema) return undefined;
    return language === 'en' ? bilingualSchema.schema.en : bilingualSchema.schema.pt;
  }, [bilingualSchema, language]);

  // Determine the schema used for editing (always English for now, but pass both for saving)
  const editingSchema = bilingualSchema?.schema.en;
  const ptSchemaDraft = bilingualSchema?.schema.pt;

  return (
    <div className="p-2 md:p-4 w-full flex flex-col items-center pt-0"> {/* Reduced padding, removed h1 */}
      {loading && (
        <div className="w-full max-w-3xl space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="w-full max-w-3xl mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Schema Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {editingSchema && ptSchemaDraft && (
        <>
          {isAuthorized && (
            <AdminFormEditor 
              currentSchema={editingSchema} // Always pass EN schema for editing structure
              ptSchemaDraft={ptSchemaDraft} // Pass PT schema draft for saving
              onSchemaUpdate={handleSchemaUpdate} 
            />
          )}
          {activeSchema && (
            <DynamicFeedbackForm 
              schema={activeSchema} 
              isEditing={isAuthorized} 
              setIsSubmitting={setIsSubmitting} 
            />
          )}
        </>
      )}
    </div>
  );
};

const FeedbackLayout = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { language, setLanguage } = useFeedbackLanguage();
    const navigate = useNavigate();

    const handleLogoClick = (e: React.MouseEvent) => {
        e.preventDefault();
        navigate('/');
    };
    
    const languageOptions = [
        { value: 'en', label: 'English' },
        { value: 'pt', label: 'Português-BR' },
    ];

    return (
        <div className="w-full min-h-screen flex flex-col items-center">
            <StickyHeader onLogoClick={handleLogoClick} />
            
            {/* Fixed Language Selector Bar */}
            <div className="fixed top-[var(--sticky-header-height)] left-0 right-0 z-30 bg-hodl-darker border-b border-border-accent-green h-10 flex items-center justify-end px-2 md:px-4">
                <div className="flex items-center space-x-2">
                    <Label htmlFor="feedback-language" className="text-sm text-muted-foreground">Language:</Label>
                    <Select
                        value={language}
                        onValueChange={(value: 'en' | 'pt') => setLanguage(value)}
                        disabled={isSubmitting}
                    >
                        <SelectTrigger id="feedback-language" className="w-[150px] bg-card">
                            <SelectValue placeholder="Select Language" />
                        </SelectTrigger>
                        <SelectContent>
                            {languageOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            {/* Content starts below the fixed bar */}
            <div className="pt-[calc(var(--sticky-header-height)+40px)] w-full"> {/* 40px is the height of the fixed bar */}
                <FeedbackContent isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} />
            </div>
        </div>
    );
}

// Main Feedback Page component
const FeedbackPage = () => {
  return (
    <FeedbackLanguageProvider>
        <FeedbackLayout />
    </FeedbackLanguageProvider>
  );
};

export default FeedbackPage;