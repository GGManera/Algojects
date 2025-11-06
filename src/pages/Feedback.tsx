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
import { StickyHeader } from '@/components/StickyHeader'; // Import StickyHeader
import { useNavigate } from 'react-router-dom'; // Import useNavigate

const FeedbackPage = () => {
  const { activeAddress } = useWallet();
  const [schema, setSchema] = useState<FormStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const navigate = useNavigate(); // Initialize useNavigate

  const adminWallet = import.meta.env.VITE_FEEDBACK_ADMIN_WALLET;

  const isAuthorized = useMemo(() => {
    return activeAddress === adminWallet;
  }, [activeAddress, adminWallet]);

  const fetchSchema = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedSchema = await fetchFormStructure();
      setSchema(fetchedSchema);
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

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/'); // Navigate to the home page
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center pt-12"> {/* Added pt-12 for header spacing */}
      <StickyHeader onLogoClick={handleLogoClick} /> {/* Add StickyHeader */}
      <div className="p-4 md:p-8 w-full flex flex-col items-center"> {/* Wrapped content in a div for consistent padding */}
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
    </div>
  );
};

export default FeedbackPage;