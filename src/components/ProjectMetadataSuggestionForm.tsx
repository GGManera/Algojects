"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { PROTOCOL_ADDRESS, getNextProposedNoteEditId, generateHash } from "@/lib/social";
import { Project } from "@/types/social";
import { useNfd } from "@/hooks/useNfd";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PaymentConfirmationDialog } from "./PaymentConfirmationDialog";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { retryFetch } from "@/utils/api";
import { ProjectMetadata, MetadataItem } from '@/types/project';
import { ArrowRight, AlertTriangle, PlusCircle, Hash, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { MetadataItemEditor } from "./MetadataItemEditor";

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";
const MAX_NOTE_SIZE_BYTES = 1024;
const TRANSACTION_TIMEOUT_MS = 60000;
const SUGGESTION_FEE_MICRO_ALGOS = 100_000; // 0.1 ALGO fee for suggestion

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

interface ProjectMetadataSuggestionFormProps {
  project: Project;
  onInteractionSuccess: () => void;
  initialMetadata: ProjectMetadata; // Still useful for context, but not for editing
}

export function ProjectMetadataSuggestionForm({ project, onInteractionSuccess, initialMetadata }: ProjectMetadataSuggestionFormProps) {
  // State now holds ONLY the items the user is suggesting to add/edit
  const [suggestedItems, setSuggestedItems] = useState<ProjectMetadata>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionsToConfirm, setTransactionsToConfirm] = useState<TransactionDisplayItem[]>([]);
  const [preparedAtc, setPreparedAtc] = useState<algosdk.AtomicTransactionComposer | null>(null);
  const loadingToastIdRef = useRef<string | null>(null);

  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { nfd, loading: nfdLoading } = useNfd(activeAddress);
  const { settings } = useSettings();

  // Handlers now operate on suggestedItems state
  const handleUpdateMetadataItem = useCallback((index: number, field: keyof MetadataItem, value: string) => {
    setSuggestedItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }, []);

  const handleUpdateMetadataType = useCallback((index: number, type: MetadataItem['type']) => {
    setSuggestedItems(prev => prev.map((item, i) => i === index ? { ...item, type } : item));
  }, []);

  const handleRemoveMetadataItem = useCallback((index: number) => {
    setSuggestedItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddMetadataItem = useCallback(() => {
    setSuggestedItems(prev => [...prev, { title: '', value: '', type: 'text' }]);
  }, []);

  // Reconstruct the final JSON string from the state array (this is the delta)
  const finalJsonContent = useMemo(() => {
    // Only include items that have both title and value
    const cleanedItems = suggestedItems.filter(item => item.title.trim() && item.value.trim());
    return JSON.stringify(cleanedItems, null, 2);
  }, [suggestedItems]);

  const isReadyToSubmit = useMemo(() => {
    return finalJsonContent.trim() !== '[]' && finalJsonContent.trim() !== '';
  }, [finalJsonContent]);

  const handleSubmit = async () => {
    const atc = await prepareTransactions();
    if (atc) {
      if (settings.showTransactionConfirmation) {
        setIsDialogOpen(true);
      } else {
        await executeTransactions(atc);
      }
    }
  };

  const prepareTransactions = async (): Promise<algosdk.AtomicTransactionComposer | null> => {
    if (!activeAddress || !transactionSigner) {
      showError("Please connect your wallet to suggest metadata changes.");
      return null;
    }
    if (!nfd?.name) {
      showError("You must have an NFD to suggest metadata changes.");
      return null;
    }
    if (!isReadyToSubmit) {
      showError("Please add at least one valid metadata item (Title and Value required).");
      return null;
    }

    setIsLoading(true);
    const toastId = showLoading("Preparing metadata suggestion...");

    try {
      const indexerStatusResponse = await retryFetch(`${INDEXER_URL}/v2/transactions?limit=1`, undefined, 5);
      if (!indexerStatusResponse.ok) throw new Error("Could not fetch network status from Indexer.");
      const indexerStatusData = await indexerStatusResponse.json();
      const lastRound = indexerStatusData['current-round'];
      if (typeof lastRound !== 'number') throw new Error("Could not get last round from the network.");

      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      const newEditId = getNextProposedNoteEditId(project.proposedNoteEdits);
      const hash = generateHash(lastRound, activeAddress);
      
      // Identifier format: [Hash].[Proj].[EditId]
      const noteIdentifierBase = `${hash}.${project.id}.${newEditId}`;
      
      // The content is the JSON string itself (the delta)
      const contentBytes = new TextEncoder().encode(finalJsonContent);
      
      // We use a special tag 'META' to distinguish this from interaction posts
      const noteIdentifierForSizing = `${noteIdentifierBase}.0 META `;
      const availableSpace = MAX_NOTE_SIZE_BYTES - new TextEncoder().encode(noteIdentifierForSizing).length;
      
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < contentBytes.length; i += availableSpace) {
        chunks.push(contentBytes.subarray(i, i + availableSpace));
      }
      if (chunks.length > 16) throw new Error("Metadata JSON is too long.");

      const displayItems: TransactionDisplayItem[] = [];

      chunks.forEach((chunk, index) => {
        const noteIdentifier = `${noteIdentifierBase}.${index} META`;
        const noteText = `${noteIdentifier} ${new TextDecoder().decode(chunk)}`;
        const noteBytes = new TextEncoder().encode(noteText);
        
        // Only the first chunk carries the fee
        const amount = index === 0 ? SUGGESTION_FEE_MICRO_ALGOS : 0;
        
        const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ 
            sender: activeAddress, 
            receiver: PROTOCOL_ADDRESS, 
            amount, 
            suggestedParams, 
            note: noteBytes 
        });
        atc.addTransaction({ txn: paymentTxn, signer: transactionSigner });
        
        if (index === 0) {
            displayItems.push({ 
                type: 'pay', 
                from: activeAddress, 
                to: PROTOCOL_ADDRESS, 
                amount: SUGGESTION_FEE_MICRO_ALGOS, 
                note: noteText, 
                role: `Metadata Suggestion Fee` 
            });
        }
      });

      dismissToast(toastId);
      setPreparedAtc(atc);
      setTransactionsToConfirm(displayItems);
      return atc;
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "An unknown error occurred during preparation.");
      setIsLoading(false);
      return null;
    }
  };

  const executeTransactions = async (atcToExecute: algosdk.AtomicTransactionComposer) => {
    if (!atcToExecute || !algodClient) {
      showError("Transaction composer not prepared.");
      return;
    }

    setIsConfirming(true);
    loadingToastIdRef.current = toast.loading("Executing metadata suggestion... Please check your wallet.");

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time. Please try again.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);

      toast.success("Metadata suggestion submitted successfully!", { id: loadingToastIdRef.current });
      setSuggestedItems([]); // Clear form on success
      onInteractionSuccess(); // Refetch social data to see the suggestion
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred during execution.", { id: loadingToastIdRef.current });
    } finally {
      setIsDialogOpen(false);
      setIsConfirming(false);
      setIsLoading(false);
      setPreparedAtc(null);
      setTransactionsToConfirm([]);
      loadingToastIdRef.current = null;
    }
  };

  const hasNfd = !!nfd?.name;
  const canSubmit = !activeAddress || isLoading || nfdLoading || !hasNfd || !isReadyToSubmit;
  const inputDisabled = !activeAddress || isLoading || nfdLoading || !hasNfd;

  if (!activeAddress || !hasNfd) {
    return (
        <Alert className="bg-muted/50 border-hodl-blue text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-hodl-blue" />
            <AlertTitle className="text-hodl-blue">Connect Wallet & Get NFD</AlertTitle>
            <AlertDescription>
                You must connect your wallet and have an NFDomain (.algo) to suggest metadata changes.
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Alert className="bg-muted/50 border-hodl-blue text-muted-foreground">
            <Hash className="h-4 w-4 text-hodl-blue" />
            <AlertTitle className="text-hodl-blue">Suggest Metadata Edit (Delta)</AlertTitle>
            <AlertDescription>
                Add or edit specific metadata fields below. Only the fields you add here will be submitted as a suggestion delta. A small fee of 0.1 ALGO applies.
            </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Suggested Fields (Delta)</h3>
          {suggestedItems.map((item, index) => (
            <MetadataItemEditor
              key={index}
              item={item}
              index={index}
              onUpdate={handleUpdateMetadataItem}
              onUpdateType={handleUpdateMetadataType}
              onRemove={handleRemoveMetadataItem}
              disabled={inputDisabled}
            />
          ))}
          <Button
            variant="outline"
            onClick={handleAddMetadataItem}
            disabled={inputDisabled}
            className="w-full mt-2"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Add New Metadata Field
          </Button>
        </div>
        
        <Button onClick={handleSubmit} disabled={canSubmit} className="w-full">
          {isLoading ? "Preparing..." : "Submit Suggestion (0.1 ALGO Fee)"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <PaymentConfirmationDialog
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            if (isConfirming && loadingToastIdRef.current) {
                dismissToast(loadingToastIdRef.current);
                toast.info("Transaction process cancelled. Please close any open wallet pop-ups if they persist.");
            }
            setIsLoading(false);
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