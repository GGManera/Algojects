"use client";

import { useState, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { toast } from "sonner";
import { PROTOCOL_ADDRESS } from "@/lib/social";
import { Project, Review, Comment, BaseInteraction } from "@/types/social";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

// Constants for like transaction
const LIKE_AMOUNT_TO_CREATOR = 100_000; // 0.1 ALGO
const LIKE_AMOUNT_TO_PROTOCOL = 10_000; // 0.01 ALGO
const TRANSACTION_TIMEOUT_MS = 60000; // 60 seconds

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
  const { activeAddress, transactionSigner, algodClient } = useWallet();

  const hasLiked = useMemo(() => {
    if (!activeAddress) return false;
    return item.likeHistory.some(like => like.sender === activeAddress && like.action === 'LIKE');
  }, [item.likeHistory, activeAddress]);

  const cannotLike = !activeAddress || activeAddress === item.sender;
  const isDisabled = cannotLike || hasLiked || isLoading;
  const isFilled = hasLiked;
  const isPink = hasLiked || cannotLike;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDisabled) return;

    // NEW: Rigorous address validation using algosdk
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
    const toastId = toast.loading("Processing your like... Please check your wallet.");

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();

      const noteIdentifier = `like.${item.id}`;
      const noteBytes = new TextEncoder().encode(noteIdentifier);

      const paymentToCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: activeAddress,
        to: item.sender,
        amount: LIKE_AMOUNT_TO_CREATOR,
        suggestedParams,
      });
      atc.addTransaction({ txn: paymentToCreatorTxn, signer: transactionSigner });

      const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: activeAddress,
        to: PROTOCOL_ADDRESS,
        amount: LIKE_AMOUNT_TO_PROTOCOL,
        suggestedParams,
        note: noteBytes,
      });
      atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });

      await Promise.race([atc.execute(algodClient, 4), timeoutPromise]);

      toast.success("Liked!", { id: toastId });
      onInteractionSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
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
  );
}