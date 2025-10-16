"use client";

import { useState, useMemo, useRef } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { toast } from "sonner";
import { PROTOCOL_ADDRESS, generateHash } from "@/lib/social";
import { Project, Review, Comment, BaseInteraction } from "@/types/social";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { PaymentConfirmationDialog } from "./PaymentConfirmationDialog";
import { useSettings } from "@/hooks/useSettings";
import { retryFetch } from "@/utils/api";

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";
const TRANSACTION_TIMEOUT_MS = 60000; // 60 seconds

// Define TransactionDisplayItem type locally for the dialog
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
  review?: Review;
  comment?: Comment;
  onInteractionSuccess: () => void;
  className?: string;
}

export function LikeButton({ item, project, review, comment, onInteractionSuccess, className }: LikeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionsToConfirm, setTransactionsToConfirm] = useState<TransactionDisplayItem[]>([]);
  const [preparedAtc, setPreparedAtc] = useState<algosdk.AtomicTransactionComposer | null>(null);
  const loadingToastIdRef = useRef<string | number | null>(null);

  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { settings } = useSettings();

  const hasLiked = useMemo(() => {
    if (!activeAddress) return false;
    return item.likeHistory.some(like => like.sender === activeAddress && like.action === 'LIKE');
  }, [item.likeHistory, activeAddress]);

  const cannotLike = !activeAddress || activeAddress === item.sender;
  const isDisabled = cannotLike || hasLiked || isLoading;
  const isFilled = hasLiked;
  const isPink = hasLiked || cannotLike;

  const executeTransactions = async (atcToExecute: algosdk.AtomicTransactionComposer) => {
    if (!atcToExecute) {
      toast.error("Transaction not prepared.");
      return;
    }

    setIsConfirming(true);
    loadingToastIdRef.current = toast.loading("Processing your like... Please check your wallet.");

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);
      toast.success("Liked!", { id: loadingToastIdRef.current });
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

  const prepareAndSubmitLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDisabled) return;

    if (!activeAddress || !algosdk.isValidAddress(activeAddress)) {
        toast.error("Your wallet address appears to be invalid. Please reconnect.");
        return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Preparing transaction...");

    try {
      const indexerStatusResponse = await retryFetch(`${INDEXER_URL}/v2/transactions?limit=1`);
      if (!indexerStatusResponse.ok) throw new Error("Could not fetch network status from Indexer.");
      const indexerStatusData = await indexerStatusResponse.json();
      const lastRound = indexerStatusData['current-round'];
      if (typeof lastRound !== 'number') throw new Error("Could not get last round from the network.");

      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      const displayItems: TransactionDisplayItem[] = [];
      const idParts = item.id.split('.');

      // Like a Review
      if (idParts.length === 2) {
        const paymentToReviewer = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: item.sender, amount: 1_000_000, suggestedParams });
        atc.addTransaction({ txn: paymentToReviewer, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: item.sender, amount: 1_000_000, role: 'Review Writer' });
      } 
      // Like a Comment
      else if (idParts.length === 3) {
        if (!review) throw new Error("Review context is required to like a comment.");
        const paymentToCommenter = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: item.sender, amount: 250_000, suggestedParams });
        atc.addTransaction({ txn: paymentToCommenter, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: item.sender, amount: 250_000, role: 'Comment Writer' });

        const paymentToReviewer = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: review.sender, amount: 250_000, suggestedParams });
        atc.addTransaction({ txn: paymentToReviewer, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: review.sender, amount: 250_000, role: 'Review Writer' });
      }
      // Like a Reply
      else if (idParts.length === 4) {
        if (!review || !comment) throw new Error("Review and Comment context are required to like a reply.");
        const paymentToReplier = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: item.sender, amount: 100_000, suggestedParams });
        atc.addTransaction({ txn: paymentToReplier, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: item.sender, amount: 100_000, role: 'Reply Writer' });

        const paymentToCommenter = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: comment.sender, amount: 100_000, suggestedParams });
        atc.addTransaction({ txn: paymentToCommenter, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: comment.sender, amount: 100_000, role: 'Comment Writer' });

        const paymentToReviewer = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: review.sender, amount: 100_000, suggestedParams });
        atc.addTransaction({ txn: paymentToReviewer, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: review.sender, amount: 100_000, role: 'Review Writer' });
      }

      // Add a 0-ALGO transaction to the protocol to record the like note on-chain in the correct format
      const hash = generateHash(lastRound, activeAddress);
      const noteIdentifier = `${hash}.${item.id}.${item.latestVersion}`;
      const noteText = `${noteIdentifier} LIKE`;
      const noteBytes = new TextEncoder().encode(noteText);
      
      const noteTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: PROTOCOL_ADDRESS, amount: 0, suggestedParams, note: noteBytes });
      atc.addTransaction({ txn: noteTxn, signer: transactionSigner });
      // No display item for this as it's a 0-ALGO transaction for data purposes

      toast.dismiss(toastId);
      setPreparedAtc(atc);
      setTransactionsToConfirm(displayItems);

      if (settings.showTransactionConfirmation) {
        setIsDialogOpen(true);
      } else {
        await executeTransactions(atc);
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An unknown error occurred.", { id: toastId });
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={prepareAndSubmitLike}
        disabled={isDisabled}
        className={cn(
          "flex items-center space-x-2 transition-colors",
          {
            "cursor-not-allowed": isDisabled,
          },
          className
        )}
      >
        <Heart
          className={cn("h-5 w-5", {
            "text-pink-400": isPink,
            "fill-current": isFilled,
          })}
        />
        <span className="font-numeric">{item.likeCount}</span>
      </button>
      <PaymentConfirmationDialog
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            // If dialog is closed without confirming, reset states
            setIsLoading(false);
            setIsConfirming(false);
            setPreparedAtc(null);
            setTransactionsToConfirm([]);
          }
        }}
        transactions={transactionsToConfirm}
        onConfirm={() => preparedAtc && executeTransactions(preparedAtc)}
        isConfirming={isConfirming}
      />
    </>
  );
}