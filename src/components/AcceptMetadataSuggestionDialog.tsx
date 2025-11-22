"use client";

import React, { useState, useMemo, useRef } from 'react';
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
import { acceptMetadataSuggestionAndReward } from '@/lib/coda'; // Import the new function
import { PaymentConfirmationDialog } from './PaymentConfirmationDialog'; // Import PaymentConfirmationDialog
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';
import { PROTOCOL_ADDRESS } from '@/lib/social'; // Import PROTOCOL_ADDRESS

const SUGGESTION_REWARD_ALGO = 0.2; // UPDATED to 0.2 ALGO
const TRANSACTION_TIMEOUT_MS = 60000;

interface TransactionDisplayItem {
  type: 'pay' | 'axfer';
  from: string;
  to?: string;
  amount?: number;
  assetId?: number;
  note?: string;
  isOptIn?: boolean;
  role?: 'Review Writer' | 'Comment Writer' | 'Reply Writer' | 'Protocol';
}

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
        // Use title and type for matching, as title might change if the user is editing a generic field
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
  const { settings } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [transactionsToConfirm, setTransactionsToConfirm] = useState<TransactionDisplayItem[]>([]);
  const [preparedAtc, setPreparedAtc] = useState<algosdk.AtomicTransactionComposer | null>(null);
  const loadingToastIdRef = useRef<string | null>(null);

  const [suggestedDelta, setSuggestedDelta] = useState<ProjectMetadata | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse the suggested JSON content (the delta) when the dialog opens or suggestion changes
  useMemo(() => {
    try {
      // 1. Trim whitespace
      let cleanedContent = suggestion.content.trim();
      
      // 2. Remove control characters (like newlines, tabs, etc.) that might break JSON.parse
      cleanedContent = cleanedContent.replace(/[\r\n\t]/g, '');
      
      const parsed = JSON.parse(cleanedContent);
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

  const handlePrepareAccept = async () => {
    if (!finalMergedMetadata || parseError) {
      showError("Cannot accept: Invalid metadata format or parsing error.");
      return;
    }
    if (!activeAddress || !transactionSigner || !algodClient) {
      showError("Wallet not connected.");
      return;
    }

    setIsProcessing(true);
    const toastId = showLoading("Preparing acceptance transaction...");

    try {
      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      const rewardMicroAlgos = SUGGESTION_REWARD_ALGO * 1_000_000;

      // 1. Payment to Proposer (0.2 ALGO reward)
      const paymentToProposerTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: suggestion.sender,
        amount: rewardMicroAlgos,
        suggestedParams,
        note: new TextEncoder().encode(`Reward for accepted metadata suggestion (TX: ${suggestion.txId.substring(0, 10)}...)`),
      });
      atc.addTransaction({ txn: paymentToProposerTxn, signer: transactionSigner });

      // 2. Data Transaction to Protocol (0 ALGO) to record the acceptance
      const acceptTag = `ACCEPT.${project.id}.${suggestion.txId}`;
      const dataTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: PROTOCOL_ADDRESS,
        amount: 0,
        suggestedParams,
        note: new TextEncoder().encode(acceptTag),
      });
      atc.addTransaction({ txn: dataTxn, signer: transactionSigner });

      dismissToast(toastId);
      setPreparedAtc(atc);
      setTransactionsToConfirm([
        { type: 'pay', from: activeAddress, to: suggestion.sender, amount: rewardMicroAlgos, role: 'Suggestion Reward' },
        { type: 'pay', from: activeAddress, to: PROTOCOL_ADDRESS, amount: 0, note: acceptTag, role: 'Acceptance Data' },
      ]);

      if (settings.showTransactionConfirmation) {
        setIsPaymentDialogOpen(true);
      } else {
        await executeTransactions(atc);
      }

    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "An unknown error occurred during preparation.");
      setIsProcessing(false);
    }
  };

  const executeTransactions = async (atcToExecute: algosdk.AtomicTransactionComposer) => {
    if (!atcToExecute || !algodClient) {
      showError("Transaction composer not prepared.");
      return;
    }

    setIsConfirming(true);
    loadingToastIdRef.current = toast.loading("Executing acceptance and reward... Please check your wallet.");

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time. Please try again.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);

      // 3. Update Coda Metadata (only after on-chain TX is confirmed)
      await acceptMetadataSuggestionAndReward(
        project.id,
        suggestion.sender,
        suggestion.txId,
        finalMergedMetadata,
        activeAddress!,
        transactionSigner!,
        algodClient!
      );

      toast.success("Suggestion accepted! Proposer rewarded and Coda updated.", { id: loadingToastIdRef.current });
      onInteractionSuccess(); // Refetch social data and project details
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to execute acceptance or update Coda.", { id: loadingToastIdRef.current });
    } finally {
      setIsPaymentDialogOpen(false);
      setIsConfirming(false);
      setIsProcessing(false);
      setPreparedAtc(null);
      setTransactionsToConfirm([]);
      loadingToastIdRef.current = null;
    }
  };

  const handleReject = () => {
    // Rejection is simply closing the dialog and doing nothing on-chain.
    // The suggestion remains pending until accepted or manually removed from Coda by an admin.
    onOpenChange(false);
    showSuccess("Suggestion rejected (not accepted).");
  };

  const deltaJsonString = suggestion.content;
  const currentJsonString = JSON.stringify(currentProjectMetadata, null, 2);
  const mergedJsonString = JSON.stringify(finalMergedMetadata, null, 2);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[900px] bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CheckCircle className="h-5 w-5" /> Review Metadata Suggestion
            </DialogTitle>
            <DialogDescription>
              Review the proposed metadata changes (delta) and the resulting merged metadata. Accepting this will update the project metadata in Coda and reward the proposer with {SUGGESTION_REWARD_ALGO} ALGO.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">Suggested By:</span>
              <UserDisplay address={suggestion.sender} textSizeClass="text-sm" avatarSizeClass="h-6 w-6" linkTo={`/profile/${suggestion.sender}`} />
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">Transaction ID:</span>
              <span className="font-mono text-xs break-all">{suggestion.txId}</span>
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
                      <pre className="whitespace-pre-wrap break-all selectable-text">{deltaJsonString}</pre>
                  </ScrollArea>
              </div>
              
              {/* Current Metadata */}
              <div className="space-y-2">
                  <h4 className="text-md font-semibold text-muted-foreground">Current Metadata (Coda)</h4>
                  <ScrollArea className="h-[300px] border rounded-md p-2 bg-muted/20 font-mono text-xs">
                      <pre className="whitespace-pre-wrap break-all selectable-text">{currentJsonString}</pre>
                  </ScrollArea>
              </div>
              
              {/* Final Merged Metadata */}
              <div className="space-y-2">
                  <h4 className="text-md font-semibold text-green-400">Final Merged Metadata (Preview)</h4>
                  <ScrollArea className="h-[300px] border rounded-md p-2 bg-muted/20 font-mono text-xs">
                      <pre className="whitespace-pre-wrap break-all selectable-text">{mergedJsonString}</pre>
                  </ScrollArea>
              </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button variant="outline" onClick={handleReject} disabled={isProcessing} className="flex-1 sm:flex-none text-destructive hover:text-destructive">
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </Button>
            <Button onClick={handlePrepareAccept} disabled={isProcessing || !!parseError} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700">
              {isProcessing ? "Preparing..." : `Accept & Reward (${SUGGESTION_REWARD_ALGO} ALGO)`}
              <CheckCircle className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <PaymentConfirmationDialog
        isOpen={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open);
          if (!open) {
            if (isConfirming && loadingToastIdRef.current) {
                dismissToast(loadingToastIdRef.current);
                toast.info("Transaction process cancelled. Please close any open wallet pop-ups if they persist.");
            }
            setIsProcessing(false);
            setIsConfirming(false);
            setPreparedAtc(null);
            setTransactionsToConfirm([]);
            loadingToastIdRef.current = null;
          }
        }}
        transactions={transactionsToConfirm}
        onConfirm={() => preparedAtc && executeTransactions(preparedAtc)}
        isConfirming={isConfirming}
      />
    </>
  );
}