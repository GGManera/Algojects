"use client";

import React, { useState, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { PROTOCOL_ADDRESS, generateHash } from "@/lib/social";
import { BaseInteraction, Project, Review, Comment } from '@/types/social';
import { InteractionCardInput } from './InteractionCardInput';
import { ReviewPreview } from './ReviewPreview';
import { PaymentConfirmationDialog } from './PaymentConfirmationDialog';
import { useSettings } from '@/hooks/useSettings';
import { toast } from "sonner";
import { retryFetch } from "@/utils/api";
import { Edit, ArrowRight } from 'lucide-react';

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";
const MAX_NOTE_SIZE_BYTES = 1024;
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

interface EditInteractionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: BaseInteraction;
  project: Project;
  review?: Review;
  comment?: Comment;
  onInteractionSuccess: () => void;
}

export function EditInteractionDialog({
  isOpen,
  onOpenChange,
  item,
  project,
  review,
  comment,
  onInteractionSuccess,
}: EditInteractionDialogProps) {
  const [content, setContent] = useState(item.content === "[EXCLUDED]" ? "" : item.content);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionsToConfirm, setTransactionsToConfirm] = useState<TransactionDisplayItem[]>([]);
  const [preparedAtc, setPreparedAtc] = useState<algosdk.AtomicTransactionComposer | null>(null);
  const loadingToastIdRef = useRef<string | null>(null);

  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { settings } = useSettings();

  const itemType = useMemo(() => {
    const parts = item.id.split('.');
    if (parts.length === 2) return 'review';
    if (parts.length === 3) return 'comment';
    return 'reply';
  }, [item.id]);

  // Reset content when dialog opens for a new item or closes
  React.useEffect(() => {
    if (isOpen) {
      setContent(item.content === "[EXCLUDED]" ? "" : item.content);
    }
  }, [isOpen, item.content]);

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
      showError("Please connect your wallet to edit.");
      return null;
    }
    if (!content.trim()) {
      showError("Content cannot be empty.");
      return null;
    }

    setIsLoading(true);
    const toastId = showLoading(`Preparing edit for your ${itemType}...`);

    try {
      const indexerStatusResponse = await retryFetch(`${INDEXER_URL}/v2/transactions?limit=1`, undefined, 5); // Increased retries
      if (!indexerStatusResponse.ok) throw new Error("Could not fetch network status from Indexer.");
      const indexerStatusData = await indexerStatusResponse.json();
      const lastRound = indexerStatusData['current-round'];
      if (typeof lastRound !== 'number') throw new Error("Could not get last round from the network.");

      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Determine the next version number
      const nextVersion = item.latestVersion + 1;
      
      // Reconstruct the base identifier parts (Proj.Rev.Comm.Rep)
      const idParts = item.id.split('.');
      const proj = idParts[0];
      const rev = idParts[1];
      const comm = idParts.length > 2 ? idParts[2] : '0';
      const rep = idParts.length > 3 ? idParts[3] : '0';

      const hash = generateHash(lastRound, activeAddress);
      
      // Construct the note identifier base: [Hash].[Proj].[Rev].[Comm].[Rep].[NextVersion]
      const noteIdentifierBase = `${hash}.${proj}.${rev}.${comm}.${rep}.${nextVersion}`;
      
      const noteIdentifierForSizing = `${noteIdentifierBase}.0 `;
      const availableSpace = MAX_NOTE_SIZE_BYTES - new TextEncoder().encode(noteIdentifierForSizing).length;
      const contentBytes = new TextEncoder().encode(content);
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < contentBytes.length; i += availableSpace) {
        chunks.push(contentBytes.subarray(i, i + availableSpace));
      }
      if (chunks.length > 16) throw new Error("Content is too long.");

      const displayItems: TransactionDisplayItem[] = [];

      // Only the first chunk needs to carry the 0 ALGO payment to the protocol
      chunks.forEach((chunk, index) => {
        const noteIdentifier = `${noteIdentifierBase}.${index}`;
        const noteText = `${noteIdentifier} ${new TextDecoder().decode(chunk)}`;
        const noteBytes = new TextEncoder().encode(noteText);
        
        // 0 ALGO payment to the protocol to record the edit
        const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ 
            sender: activeAddress, 
            receiver: PROTOCOL_ADDRESS, 
            amount: 0, 
            suggestedParams, 
            note: noteBytes 
        });
        atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });
        
        // Only display the first transaction for confirmation
        if (index === 0) {
            displayItems.push({ 
                type: 'pay', 
                from: activeAddress, 
                to: PROTOCOL_ADDRESS, 
                amount: 0, 
                note: noteText, 
                role: `Edit ${itemType} (Version ${nextVersion})` 
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
    loadingToastIdRef.current = toast.loading(`Executing edit for your ${itemType}... Please check your wallet.`);

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time. Please try again.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);

      toast.success(`Your ${itemType} has been updated!`, { id: loadingToastIdRef.current });
      onInteractionSuccess();
      onOpenChange(false);
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

  const canSubmit = !activeAddress || isLoading || !content.trim();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px] bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="gradient-text flex items-center gap-2">
                <Edit className="h-5 w-5" /> Edit {itemType.charAt(0).toUpperCase() + itemType.slice(1)}
            </DialogTitle>
            <DialogDescription>
              Update the content of your post. This will create a new version (v{item.latestVersion + 1}) on-chain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <InteractionCardInput
              type={itemType === 'review' ? 'review' : itemType === 'comment' ? 'comment' : 'reply'}
              placeholder={`Edit your ${itemType}...`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isLoading}
              onSubmit={handleSubmit}
              isSubmitDisabled={canSubmit}
            />
            <ReviewPreview content={content} type={itemType === 'review' ? 'review' : itemType === 'comment' ? 'comment' : 'reply'} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={canSubmit}>
              {isLoading ? "Preparing..." : "Save Changes"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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