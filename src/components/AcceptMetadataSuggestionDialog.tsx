"use client";

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProposedNoteEdit, Project } from '@/types/social';
import { UserDisplay } from './UserDisplay';
import { formatTimestamp } from '@/lib/utils';
import { CheckCircle, XCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { useProjectDetails } from '@/hooks/useProjectDetails';
import { showError, showSuccess, showLoading, dismissToast } from '@/utils/toast';
import { useWallet } from '@txnlab/use-wallet-react';
import { ProjectMetadata, MetadataItem } from '@/types/project';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface AcceptMetadataSuggestionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: ProposedNoteEdit;
  project: Project;
  currentProjectMetadata: ProjectMetadata;
  onInteractionSuccess: () => void;
}

// Helper function to merge delta into base metadata
const mergeMetadata = (base: ProjectMetadata, delta: ProjectMetadata): ProjectMetadata => {
    const newMetadata = [...base];
    
    delta.forEach(deltaItem => {
        const existingIndex = newMetadata.findIndex(baseItem => 
            baseItem.title === deltaItem.title && baseItem.type === deltaItem.type
        );

        if (existingIndex !== -1) {
            // Update existing item
            newMetadata[existingIndex] = deltaItem;
        } else {
            // Add new item
            newMetadata.push(deltaItem);
        }
    });
    
    // Filter out items where value is empty (implying deletion/removal)
    return newMetadata.filter(item => item.value.trim() !== '');
};


export function AcceptMetadataSuggestionDialog({
  isOpen,
  onOpenChange,
  suggestion,
  project,
  currentProjectMetadata,
  onInteractionSuccess,
}: AcceptMetadataSuggestionDialogProps) {
  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { updateProjectDetails } = useProjectDetails();
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestedDelta, setSuggestedDelta] = useState<ProjectMetadata | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse the suggested JSON content (the delta) when the dialog opens or suggestion changes
  useMemo(() => {
    try {
      const parsed = JSON.parse(suggestion.content);
      if (Array.isArray(parsed)) {
        setSuggestedDelta(parsed as ProjectMetadata);
        setParseError(null);
      } else {
        setSuggestedDelta(null);
        setParseError("Suggested content is not a valid JSON array (delta).");
      }
    } catch (e) {
      setSuggestedDelta(null);
      setParseError("Failed to parse suggested JSON content (delta).");
    }
  }, [suggestion.content]);
  
  // Calculate the final merged metadata for preview
  const finalMergedMetadata = useMemo(() => {
      if (!suggestedDelta) return currentProjectMetadata;
      return mergeMetadata(currentProjectMetadata, suggestedDelta);
  }, [currentProjectMetadata, suggestedDelta]);

  const handleAccept = async () => {
    if (!finalMergedMetadata || parseError) {
      showError("Cannot accept: Invalid metadata format or parsing error.");
      return;
    }
    if (!activeAddress || !transactionSigner || !algodClient) {
      showError("Wallet not connected.");
      return;
    }

    setIsProcessing(true);
    const toastId = showLoading("Accepting suggestion and updating Coda...");

    try {
      // Use the calculated finalMergedMetadata
      await updateProjectDetails({
        projectId: project.id,
        newProjectMetadata: finalMergedMetadata,
      });

      dismissToast(toastId);
      showSuccess("Suggestion accepted! Project details updated in Coda.");
      onInteractionSuccess(); // Refetch social data and project details
      onOpenChange(false);
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "Failed to accept suggestion and update Coda.");
    } finally {
      setIsProcessing(false);
    }
  };

  const deltaJsonString = suggestion.content;
  const currentJsonString = JSON.stringify(currentProjectMetadata, null, 2);
  const mergedJsonString = JSON.stringify(finalMergedMetadata, null, 2);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <CheckCircle className="h-5 w-5" /> Review Metadata Suggestion
          </DialogTitle>
          <DialogDescription>
            Review the proposed metadata changes (delta) and the resulting merged metadata. Accepting this will update the project metadata in Coda.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
            <span className="text-sm text-muted-foreground">Suggested By:</span>
            <UserDisplay address={suggestion.sender} textSizeClass="text-sm" avatarSizeClass="h-6 w-6" linkTo={`/profile/${suggestion.sender}`} />
          </div>
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
            <span className="text-sm text-muted-foreground">Transaction ID:</span>
            <span className="font-mono text-xs break-all">{suggestion.txId.substring(0, 10)}...</span>
          </div>
        </div>

        {parseError && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Parsing Error</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
            </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Suggested Delta */}
            <div className="space-y-2">
                <h4 className="text-md font-semibold text-primary">Suggested Delta (On-Chain)</h4>
                <ScrollArea className="h-[300px] border rounded-md p-2 bg-muted/20 font-mono text-xs">
                    <pre className="whitespace-pre-wrap break-all">{deltaJsonString}</pre>
                </ScrollArea>
            </div>
            
            {/* Current Metadata */}
            <div className="space-y-2">
                <h4 className="text-md font-semibold text-muted-foreground">Current Metadata (Coda)</h4>
                <ScrollArea className="h-[300px] border rounded-md p-2 bg-muted/20 font-mono text-xs">
                    <pre className="whitespace-pre-wrap break-all">{currentJsonString}</pre>
                </ScrollArea>
            </div>
            
            {/* Final Merged Metadata */}
            <div className="space-y-2">
                <h4 className="text-md font-semibold text-green-400">Final Merged Metadata (Preview)</h4>
                <ScrollArea className="h-[300px] border rounded-md p-2 bg-muted/20 font-mono text-xs">
                    <pre className="whitespace-pre-wrap break-all">{mergedJsonString}</pre>
                </ScrollArea>
            </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-2 pt-4">
          <Button variant="outline" onClick={handleReject} disabled={isProcessing} className="flex-1 sm:flex-none text-destructive hover:text-destructive">
            <XCircle className="mr-2 h-4 w-4" /> Reject
          </Button>
          <Button onClick={handleAccept} disabled={isProcessing || !!parseError} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700">
            {isProcessing ? "Processing..." : "Accept & Update Coda"}
            <CheckCircle className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}