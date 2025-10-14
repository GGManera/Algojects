"use client";

import { useState, useMemo, useRef } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { toast } from "sonner";
import { PROTOCOL_ADDRESS } from "@/lib/social";
import { Project, Review, Comment, BaseInteraction } from "@/types/social";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { PaymentConfirmationDialog } from "./PaymentConfirmationDialog";
import { useSettings } from "@/hooks/useSettings";

// Constants for like transaction
const LIKE_AMOUNT_TO_CREATOR = 100_000; // 0.1 ALGO
const LIKE_AMOUNT_TO_PROTOCOL = 10_000; // 0.01 ALGO
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
  role?: 'Review Writer' | 'Comment Writer' | 'Reply Writer' | 'Protocol' | 'Content Creator';
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
    if (!item.sender || !algosdk.isValidAddress(item.sender)) {
        toast.error("Cannot like this content, the author's address is invalid.");
        console.error("Attempted to like content with invalid sender address:", item.sender);
        return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Preparing transaction...");

    try {
      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      const displayItems: TransactionDisplayItem[] = [];

      const noteIdentifier = `like.${item.id}`;
      const noteBytes = new TextEncoder().encode(noteIdentifier);

      const paymentToCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: item.sender,
        amount: LIKE_AMOUNT_TO_CREATOR,
        suggestedParams,
      });
      atc.addTransaction({ txn: paymentToCreatorTxn, signer: transactionSigner });
      displayItems.push({
        type: 'pay',
        from: activeAddress,
        to: item.sender,
        amount: LIKE_AMOUNT_TO_CREATOR,
        role: 'Content Creator'
      });

      const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: PROTOCOL_ADDRESS,
        amount: LIKE_AMOUNT_TO_PROTOCOL,
        suggestedParams,
        note: noteBytes,
      });
      atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });
      displayItems.push({
        type: 'pay',
        from: activeAddress,
        to: PROTOCOL_ADDRESS,
        amount: LIKE_AMOUNT_TO_PROTOCOL,
        note: noteIdentifier,
        role: 'Protocol'
      });

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