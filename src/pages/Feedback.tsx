"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { fetchFormStructure, FormStructure } from '@/lib/feedback-api';
import { DynamicFeedbackForm } from '@/components/DynamicFeedbackForm';
import { AdminFormEditor } from '@/components/AdminFormEditor';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Bug, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const FeedbackPage = () => {
  const { activeAddress } = useWallet();
  const [schema, setSchema] = useState<FormStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [debugInfo, setDebugInfo] = useState<any>(null); // State to hold debug info

  const adminWallet = import.meta.env.VITE_FEEDBACK_ADMIN_WALLET;

  const isAuthorized = useMemo(() => {
    return activeAddress === adminWallet;
  }, [activeAddress, adminWallet]);

  const fetchSchema = async () => {
    setLoading(true);
    setError(null);
    setDebugInfo(null);
    try {
      const fetchedSchema = await fetchFormStructure();
      setSchema(fetchedSchema);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load form schema.";
      setError(errorMessage);
      
      // Attempt to parse the error message for debug info
      const match = errorMessage.match(/Coda API responded with status (\d+): (.*)/);
      
      // Use import.meta.env for client-side access
      setDebugInfo({
        status: match ? match[1] : 'Unknown',
        rawError: match ? match[2] : errorMessage,
        env: {
          VITE_CODA_FEEDBACK_DOC_ID: import.meta.env.VITE_CODA_FEEDBACK_DOC_ID,
          VITE_CODA_FORM_STRUCTURE_TABLE_ID: import.meta.env.VITE_CODA_FORM_STRUCTURE_TABLE_ID,
          VITE_CODA_FORM_STRUCTURE_COLUMN_ID: import.meta.env.VITE_CODA_FORM_STRUCTURE_COLUMN_ID,
        }
      });
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

  return (
    <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center">
      <h1 className="text-4xl font-bold gradient-text mb-6">AlgoJects Feedback Portal</h1>
      
      {loading && (
        <div className="w-full max-w-3xl space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && (
        <>
          <Alert variant="destructive" className="w-full max-w-3xl mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Schema Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          
          {debugInfo && (
            <Alert className="w-full max-w-3xl bg-muted/50 border-hodl-blue text-muted-foreground">
              <Bug className="h-4 w-4 text-hodl-blue" />
              <AlertTitle className="text-hodl-blue">Debug Information (Check .env.local)</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="font-semibold text-sm">API Status: <span className="text-red-400">{debugInfo.status}</span></p>
                <p className="font-semibold text-sm">Raw Error: <span className="font-mono text-xs break-all">{debugInfo.rawError}</span></p>
                <div className="pt-2 space-y-1 text-xs font-mono">
                  <p>VITE_CODA_FEEDBACK_DOC_ID: {debugInfo.env.VITE_CODA_FEEDBACK_DOC_ID || 'MISSING'}</p>
                  <p>VITE_CODA_FORM_STRUCTURE_TABLE_ID: {debugInfo.env.VITE_CODA_FORM_STRUCTURE_TABLE_ID || 'MISSING'}</p>
                  <p>VITE_CODA_FORM_STRUCTURE_COLUMN_ID: {debugInfo.env.VITE_CODA_FORM_STRUCTURE_COLUMN_ID || 'MISSING'}</p>
                </div>
                <p className="text-xs pt-2 flex items-center gap-1"><Info className="h-3 w-3" /> Ensure CODA_FEEDBACK_API_KEY has access to VITE_CODA_FEEDBACK_DOC_ID.</p>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {schema && (
        <>
          {isAuthorized && (
            <AdminFormEditor 
              currentSchema={schema} 
              onSchemaUpdate={handleSchemaUpdate} 
            />
          )}
          <DynamicFeedbackForm 
            schema={schema} 
            isEditing={isAuthorized} 
          />
        </>
      )}
    </div>
  );
};

export default FeedbackPage;