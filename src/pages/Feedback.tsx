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
const FeedbackContent = () => {
  const { activeAddress } = useWallet();
  const [bilingualSchema, setBilingualSchema] = useState<BilingualFormStructureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const { language, setLanguage } = useFeedbackLanguage(); // Use language context
  const [isSubmitting, setIsSubmitting] = useState(false); // Added isSubmitting state for Select disabled prop

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

  // Text content based on language
  const title = language === 'en' ? "AlgoJects Feedback Portal" : "Portal de Feedback AlgoJects";
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'pt', label: 'Português-BR' },
  ];

  return (
    <div className="p-4 md:p-8 w-full flex flex-col items-center">
      <h1 className="text-4xl font-bold gradient-text mb-6">{title}</h1>
      
      {/* Language Selector */}
      <div className="w-full max-w-3xl flex justify-end mb-4">
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
              // Pass setIsSubmitting down so the Select component can be disabled during submission
              setIsSubmitting={setIsSubmitting} 
            />
          )}
        </>
      )}
    </div>
  );
};

// Main Feedback Page component
const FeedbackPage = () => {
  const navigate = useNavigate();

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center pt-12">
      <StickyHeader onLogoClick={handleLogoClick} />
      <FeedbackLanguageProvider>
        <FeedbackContent />
      </FeedbackLanguageProvider>
    </div>
  );
};

export default FeedbackPage;