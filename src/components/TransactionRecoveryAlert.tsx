"use client";

import React, { useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, XCircle } from 'lucide-react';
import { TransactionDraft } from '@/hooks/useTransactionDraft';
import { cn } from '@/lib/utils';
import { useNfd } from '@/hooks/useNfd';
import { Skeleton } from './ui/skeleton';

interface TransactionRecoveryAlertProps {
  draft: TransactionDraft;
  onResume: (draft: TransactionDraft) => void;
  onDiscard: () => void;
}

export function TransactionRecoveryAlert({ draft, onResume, onDiscard }: TransactionRecoveryAlertProps) {
  const { nfd, loading: nfdLoading } = useNfd(draft.address);

  const { title, description } = useMemo(() => {
    let t = "Unfinished Transaction Draft Found";
    let d = "A draft for an interaction was found. You can resume or discard it.";

    const userDisplay = nfdLoading 
        ? <Skeleton className="h-4 w-24 inline-block" /> 
        : (nfd?.name || `${draft.address.substring(0, 8)}...`);

    switch (draft.type) {
      case 'project':
        t = "Unfinished Project Creation";
        d = `A draft for creating project "${draft.metadataDraft?.projectName || 'Untitled Project'}" by ${userDisplay} was found.`;
        break;
      case 'review':
        t = "Unfinished Review Draft";
        d = `A draft review for Project ${draft.projectId} by ${userDisplay} was found.`;
        break;
      case 'comment':
        t = "Unfinished Comment Draft";
        d = `A draft comment on Review ${draft.parentReviewId} in Project ${draft.projectId} by ${userDisplay} was found.`;
        break;
      case 'reply':
        t = "Unfinished Reply Draft";
        d = `A draft reply on Comment ${draft.parentCommentId} in Project ${draft.projectId} by ${userDisplay} was found.`;
        break;
      case 'metadata-suggestion':
        t = "Unfinished Metadata Suggestion";
        d = `A draft suggestion for Project ${draft.projectId} by ${userDisplay} was found.`;
        break;
      default:
        break;
    }
    return { title: t, description: d };
  }, [draft, nfd, nfdLoading]);

  return (
    <div className={cn(
        "fixed bottom-0 left-0 right-0 z-[60] p-4 md:p-6",
        "bg-hodl-darker border-t border-yellow-500/50 shadow-deep-lg",
        "md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:rounded-lg"
    )}>
      <Alert className="bg-yellow-900/20 border-yellow-500 text-yellow-400">
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-400">{title}</AlertTitle>
        <AlertDescription className="text-sm">
          {description}
        </AlertDescription>
        <div className="flex justify-end space-x-3 mt-4">
          <Button 
            variant="ghost" 
            onClick={onDiscard} 
            className="text-red-400 hover:bg-red-900/30"
          >
            <XCircle className="h-4 w-4 mr-2" /> Discard
          </Button>
          <Button 
            onClick={() => onResume(draft)} 
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            Resume Draft
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Alert>
    </div>
  );
}