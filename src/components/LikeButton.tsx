"use client";

import { useState, useRef } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { PROTOCOL_ADDRESS, generateHash } from "@/lib/social";
import { cn } from "@/lib/utils";
import { BaseInteraction, Project, Review, Comment } from "@/types/social";
import { PaymentConfirmationDialog } from "./PaymentConfirmationDialog";
import { useSettings } from "./../hooks/useSettings"; // Corrected import path
import { toast } from "sonner";
import { retryFetch } from "@/utils/api"; // Import retryFetch

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";
const TRANSACTION_TIMEOUT_MS = 60000; // 60 seconds timeout for wallet response

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

interface LikeButtonProps {
  item: BaseInteraction;
  project: Project;
  onInteractionSuccess: () => void;
  className?: string;
  review?: Review;
  comment?: Comment;
}

export function LikeButton({ item, project, onInteractionSuccess, className, review, comment }: LikeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionsToConfirm, setTransactionsToConfirm] = useState<TransactionDisplayItem[]>([]);
  const [preparedAtc, setPreparedAtc] = useState<algosdk.AtomicTransactionComposer | null>(null);
  const loadingToastIdRef = useRef<string | null>(null);

  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { settings } = useSettings();

  const isLiked = activeAddress ? item.likes.has(activeAddress) : false;

  const handleLikeClick = async () => {
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
      showError("Please connect your wallet to like.");
      return null;
    }
    if (!item.sender) {
      showError("Cannot like content without a specified creator.");
      return null;
    }
    if (activeAddress === item.sender) {
      showError("You cannot like your own content.");
      return null;
    }

    setIsLoading(true);
    const toastId = showLoading(isLiked ? "Preparing unlike..." : "Preparing like...");

    try {
      const indexerStatusResponse = await retryFetch(`${INDEXER_URL}/v2/transactions?limit=1`);
      if (!indexerStatusResponse.ok) throw new Error("Could not fetch network status from Indexer.");
      const indexerStatusData = await indexerStatusResponse.json();
      const lastRound = indexerStatusData['current-round'];
      if (typeof lastRound !== 'number') throw new Error("Could not get last round from the network.");

      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      const hash = generateHash(lastRound, activeAddress);
      const noteIdentifier = `${hash}.${item.id}.${item.latestVersion}`;
      const noteText = `${noteIdentifier} ${isLiked ? 'UNLIKE' : 'LIKE'}`;
      const note = new TextEncoder().encode(noteText);
      const idParts = item.id.split('.');
      const itemType = idParts.length === 2 ? 'review' : idParts.length === 3 ? 'comment' : 'reply';
      const displayItems: TransactionDisplayItem[] = [];

      const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: PROTOCOL_ADDRESS, amount: 0, suggestedParams, note });
      atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });
      displayItems.push({ type: 'pay', from: activeAddress, to: PROTOCOL_ADDRESS, amount: 0, note: noteText, role: 'Protocol' });

      if (itemType === 'review') {
        const paymentToCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: item.sender, amount: 1_000_000, suggestedParams, note });
        atc.addTransaction({ txn: paymentToCreatorTxn, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: item.sender, amount: 1_000_000, note: noteText, role: 'Review Writer' });
      } else if (itemType === 'comment' && review) {
        const paymentToCommentCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: item.sender, amount: 250_000, suggestedParams, note });
        atc.addTransaction({ txn: paymentToCommentCreatorTxn, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: item.sender, amount: 250_000, note: noteText, role: 'Comment Writer' });
        const paymentToReviewCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: review.sender, amount: 250_000, suggestedParams, note });
        atc.addTransaction({ txn: paymentToReviewCreatorTxn, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: review.sender, amount: 250_000, note: noteText, role: 'Review Writer' });
      } else if (itemType === 'reply' && review && comment) {
        const paymentToReplyCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: item.sender, amount: 100_000, suggestedParams, note });
        atc.addTransaction({ txn: paymentToReplyCreatorTxn, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: item.sender, amount: 100_000, note: noteText, role: 'Reply Writer' });
        const paymentToCommentCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: comment.sender, amount: 100_000, suggestedParams, note });
        atc.addTransaction({ txn: paymentToCommentCreatorTxn, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: comment.sender, amount: 100_000, note: noteText, role: 'Comment Writer' });
        const paymentToReviewCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: review.sender, amount: 100_000, suggestedParams, note });
        atc.addTransaction({ txn: paymentToReviewCreatorTxn, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: review.sender, amount: 100_000, note: noteText, role: 'Review Writer' });
      } else {
        throw new Error("Invalid item type or missing props for like action.");
      }

      dismissToast(toastId);
      setPreparedAtc(atc);
      setTransactionsToConfirm(displayItems);
      return atc;
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "An unknown error occurred.");
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
    loadingToastIdRef.current = toast.loading(`Executing ${isLiked ? 'unlike' : 'like'}... Please check your wallet.`);

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time. Please try again.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);

      toast.success(`Successfully ${isLiked ? 'unliked' : 'liked'}!`, { id: loadingToastIdRef.current });
      onInteractionSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred.", { id: loadingToastIdRef.current });
    } finally {
      setIsDialogOpen(false);
      setIsConfirming(false);
      setIsLoading(false);
      setPreparedAtc(null);
      setTransactionsToConfirm([]);
      loadingToastIdRef.current = null;
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLikeClick}
        disabled={!activeAddress || isLoading || activeAddress === item.sender}
        className={cn("flex items-center space-x-2", isLiked && "text-pink-400", className)}
      >
        <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
        <span className="font-numeric">{item.likeCount}</span>
      </Button>

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