"use client";

import { useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { PROTOCOL_ADDRESS, generateHash } from "@/lib/social";
import { Project, Review, Comment, Reply, BaseInteraction } from "@/types/social";
import { Heart } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useNfd } from "@/hooks/useNfd";
import { toast } from "sonner";
import { showError } from "@/utils/toast";

const getItemType = (item: BaseInteraction): 'review' | 'comment' | 'reply' => {
  const parts = item.id.split('.').length;
  if (parts === 2) return 'review';
  if (parts === 3) return 'comment';
  return 'reply';
};

interface LikeButtonProps {
  item: Review | Comment | Reply;
  project: Project;
  review?: Review;
  comment?: Comment;
  onInteractionSuccess: () => void;
  className?: string;
}

export function LikeButton({ item, project, review, comment, onInteractionSuccess, className }: LikeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { nfd } = useNfd(activeAddress);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeAddress) {
      showError("Please connect your wallet to like content.");
      return;
    }
    if (!nfd?.name) {
      showError("You must have an NFD to like content.");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Processing your like...");

    try {
      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      const lastRound = (await algodClient.status().do())['last-round'];
      const hash = generateHash(lastRound, activeAddress);
      const itemType = getItemType(item);

      const noteIdentifier = `${hash}.${item.id}.LIKE`;
      const noteBytes = new TextEncoder().encode(noteIdentifier);

      // Common payment to protocol for the like action itself
      const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: PROTOCOL_ADDRESS,
        amount: 100_000, // Like cost
        suggestedParams,
        note: noteBytes,
      });
      atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });

      // Payments to creators up the chain
      if (itemType === 'comment') {
        if (!review || !review.sender) {
          throw new Error("Review context is missing for liking a comment.");
        }
        const paymentToReviewerTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAddress,
          receiver: review.sender,
          amount: 25_000,
          suggestedParams,
        });
        atc.addTransaction({ txn: paymentToReviewerTxn, signer: transactionSigner });
      } else if (itemType === 'reply') {
        if (!review || !review.sender) {
          throw new Error("Review context is missing for liking a reply.");
        }
        if (!comment || !comment.sender) {
          throw new Error("Comment context is missing for liking a reply.");
        }
        const paymentToReviewerTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAddress,
          receiver: review.sender,
          amount: 10_000,
          suggestedParams,
        });
        atc.addTransaction({ txn: paymentToReviewerTxn, signer: transactionSigner });

        const paymentToCommenterTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAddress,
          receiver: comment.sender,
          amount: 10_000,
          suggestedParams,
        });
        atc.addTransaction({ txn: paymentToCommenterTxn, signer: transactionSigner });
      }

      await atc.execute(algodClient, 4);
      toast.success("Successfully liked!", { id: toastId });
      onInteractionSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  const isLiked = item.likeHistory.some(l => l.sender === activeAddress && l.action === 'LIKE');

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleLike}
      disabled={isLoading || !activeAddress}
      className={cn("flex items-center space-x-2", className)}
    >
      <Heart className={cn("h-5 w-5", isLiked ? "text-pink-400 fill-current" : "")} />
      <span className="font-numeric">{item.likeCount}</span>
    </Button>
  );
}