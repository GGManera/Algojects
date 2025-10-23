"use client";

import React, { useState, useRef, useMemo } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { PROTOCOL_ADDRESS, generateHash } from "@/lib/social";
import { BaseInteraction, Project, Review, Comment } from '@/types/social';
import { PaymentConfirmationDialog } from './PaymentConfirmationDialog';
import { useSettings } from '@/hooks/useSettings';
import { toast } from "sonner";
import { retryFetch } from "@/utils/api";
import { Trash2, ArrowRight } from 'lucide-react';

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

interface DeleteInteractionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: BaseInteraction;
  project: Project;
  review?: Review;
  comment?: Comment;
  onInteractionSuccess: () => void;
}

export function DeleteInteractionDialog({
  isOpen,
  onOpenChange,
  item,
  project,
  review,
  comment,
  onInteractionSuccess,
}: DeleteInteractionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
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

  const handlePrepareExclusion = async () => {
    if (!activeAddress || !transactionSigner) {
      showError("Please connect your wallet to exclude this post.");
      return null;
    }

    setIsLoading(true);
    const toastId = showLoading(`Preparing exclusion transaction for your ${itemType}...`);

    try {
      const indexerStatusResponse = await retryFetch(`${INDEXER_URL}/v2/transactions?limit=1`, undefined, 5);
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
      
      // Construct the note identifier: [Hash].[Proj].[Rev].[Comm].[Rep].[NextVersion].0
      const noteIdentifier = `${hash}.${proj}.${rev}.${comm}.${rep}.${nextVersion}.0`;
      const noteText = `${noteIdentifier} EXCLUDE`;
      const noteBytes = new TextEncoder().encode(noteText);
      
      // 0 ALGO payment to the protocol to record the exclusion
      const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ 
          sender: activeAddress, 
          receiver: PROTOCOL_ADDRESS, 
          amount: 0, 
          suggestedParams, 
          note: noteBytes 
      });
      atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });
      
      const displayItems: TransactionDisplayItem[] = [{ 
          type: 'pay', 
          from: activeAddress, 
          to: PROTOCOL_ADDRESS, 
          amount: 0, 
          note: noteText, 
          role: `Exclude ${itemType} (Version ${nextVersion})` 
      }];

      dismissToast(toastId);
      setPreparedAtc(atc);
      setTransactionsToConfirm(displayItems);
      
      if (settings.showTransactionConfirmation) {
        setIsPaymentDialogOpen(true);
      } else {
        await executeTransactions(atc);
      }
      
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "An unknown error occurred during preparation.");
      setIsLoading(false);
    }
  };

  const executeTransactions = async (atcToExecute: algosdk.AtomicTransactionComposer) => {
    if (!atcToExecute || !algodClient) {
      showError("Transaction composer not prepared.");
      return;
    }

    setIsConfirming(true);
    loadingToastIdRef.current = toast.loading(`Executing exclusion for your ${itemType}... Please check your wallet.`);

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time. Please try again.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);

      toast.success(`Your ${itemType} has been excluded!`, { id: loadingToastIdRef.current });
      onInteractionSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred during execution.", { id: loadingToastIdRef.current });
    } finally {
      setIsPaymentDialogOpen(false);
      setIsConfirming(false);
      setIsLoading(false);
      setPreparedAtc(null);
      setTransactionsToConfirm([]);
      loadingToastIdRef.current = null;
    }
  };

  return (
    <>
      <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
        <AlertDialogContent className="bg-card text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" /> Confirm Exclusion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to exclude this {itemType}? This action will mark the post as [EXCLUDED] on-chain and hide it from the application. You can still edit it later to restore the content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePrepareExclusion} disabled={isLoading}>
              {isLoading ? "Preparing..." : "Exclude Post"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentConfirmationDialog
        isOpen={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open);
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