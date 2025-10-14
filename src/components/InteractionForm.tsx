"use client";

import { useState, useRef } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { PROTOCOL_ADDRESS, getNextId, generateHash } from "@/lib/social";
import { Project, Review, Comment } from "@/types/social";
import { useNfd } from "@/hooks/useNfd";
import { ReviewPreview } from "./ReviewPreview";
import { InteractionCardInput } from "./InteractionCardInput";
import { PaymentConfirmationDialog } from "./PaymentConfirmationDialog";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { retryFetch } from "@/utils/api"; // Import retryFetch

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";
const MAX_NOTE_SIZE_BYTES = 1024;
const TRANSACTION_TIMEOUT_MS = 60000; // 60 seconds timeout for wallet response

type InteractionType = "comment" | "reply";

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

interface InteractionFormProps {
  type: InteractionType;
  project: Project;
  review: Review;
  comment?: Comment;
  onInteractionSuccess: () => void;
}

export function InteractionForm({ type, project, review, comment, onInteractionSuccess }: InteractionFormProps) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionsToConfirm, setTransactionsToConfirm] = useState<TransactionDisplayItem[]>([]);
  const [preparedAtc, setPreparedAtc] = useState<algosdk.AtomicTransactionComposer | null>(null);
  const loadingToastIdRef = useRef<string | null>(null);

  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { nfd, loading: nfdLoading } = useNfd(activeAddress);
  const { settings } = useSettings();

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
      showError("Please connect your wallet to interact.");
      return null;
    }
    if (!nfd?.name) {
      showError(`You must have an NFD to post a ${type}.`);
      return null;
    }
    if (!content.trim()) {
      showError("Content cannot be empty.");
      return null;
    }

    setIsLoading(true);
    const toastId = showLoading(`Preparing your ${type}...`);

    try {
      const indexerStatusResponse = await retryFetch(`${INDEXER_URL}/v2/transactions?limit=1`);
      if (!indexerStatusResponse.ok) throw new Error("Could not fetch network status from Indexer.");
      const indexerStatusData = await indexerStatusResponse.json();
      const lastRound = indexerStatusData['current-round'];
      if (typeof lastRound !== 'number') throw new Error("Could not get last round from the network.");

      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      const hash = generateHash(lastRound, activeAddress);
      const projectId = project.id;
      const reviewId = review.id.split('.')[1];
      let noteIdentifierBase: string;

      if (type === 'comment') {
        const nextId = getNextId(review.comments);
        noteIdentifierBase = `${hash}.${projectId}.${reviewId}.${nextId}.1`;
      } else if (type === 'reply' && comment) {
        const commentId = comment.id.split('.')[2];
        const nextId = getNextId(comment.replies);
        noteIdentifierBase = `${hash}.${projectId}.${reviewId}.${commentId}.${nextId}.1`;
      } else {
        throw new Error("Invalid interaction type or missing data.");
      }

      const noteIdentifierForSizing = `${noteIdentifierBase}.0 `;
      const availableSpace = MAX_NOTE_SIZE_BYTES - new TextEncoder().encode(noteIdentifierForSizing).length;
      const contentBytes = new TextEncoder().encode(content);
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < contentBytes.length; i += availableSpace) {
        chunks.push(contentBytes.subarray(i, i + availableSpace));
      }
      if (chunks.length > 16) throw new Error("Content is too long.");

      const displayItems: TransactionDisplayItem[] = [];

      if (type === 'comment') {
        const paymentToReviewCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: review.sender, amount: 250_000, suggestedParams });
        atc.addTransaction({ txn: paymentToReviewCreatorTxn, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: review.sender, amount: 250_000, note: `Payment for comment on review ${reviewId}`, role: 'Review Writer' });

        chunks.forEach((chunk, index) => {
          const noteIdentifier = `${noteIdentifierBase}.${index}`;
          const noteText = `${noteIdentifier} ${new TextDecoder().decode(chunk)}`;
          const noteBytes = new TextEncoder().encode(noteText);
          const amount = index === 0 ? 250_000 : 0;
          const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: PROTOCOL_ADDRESS, amount, suggestedParams, note: noteBytes });
          atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });
          displayItems.push({ type: 'pay', from: activeAddress, to: PROTOCOL_ADDRESS, amount: amount, note: noteText, role: 'Protocol' });
        });
      } else if (type === 'reply' && comment) {
        if (activeAddress === review.sender) {
          chunks.forEach((chunk, index) => {
            const noteIdentifier = `${noteIdentifierBase}.${index}`;
            const noteText = `${noteIdentifier} ${new TextDecoder().decode(chunk)}`;
            const noteBytes = new TextEncoder().encode(noteText);
            const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: PROTOCOL_ADDRESS, amount: 0, suggestedParams, note: noteBytes });
            atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });
            displayItems.push({ type: 'pay', from: activeAddress, to: PROTOCOL_ADDRESS, amount: 0, note: noteText, role: 'Protocol' });
          });
        } else {
          const paymentToReviewCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: review.sender, amount: 100_000, suggestedParams });
          atc.addTransaction({ txn: paymentToReviewCreatorTxn, signer: transactionSigner });
          displayItems.push({ type: 'pay', from: activeAddress, to: review.sender, amount: 100_000, note: `Payment for reply on review ${reviewId}`, role: 'Review Writer' });

          const paymentToCommentCreatorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: comment.sender, amount: 100_000, suggestedParams });
          atc.addTransaction({ txn: paymentToCommentCreatorTxn, signer: transactionSigner });
          displayItems.push({ type: 'pay', from: activeAddress, to: comment.sender, amount: 100_000, note: `Payment for reply on comment ${comment.id.split('.')[2]}`, role: 'Comment Writer' });

          chunks.forEach((chunk, index) => {
            const noteIdentifier = `${noteIdentifierBase}.${index}`;
            const noteText = `${noteIdentifier} ${new TextDecoder().decode(chunk)}`;
            const noteBytes = new TextEncoder().encode(noteText);
            const amount = index === 0 ? 100_000 : 0;
            const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: PROTOCOL_ADDRESS, amount, suggestedParams, note: noteBytes });
            atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });
            displayItems.push({ type: 'pay', from: activeAddress, to: PROTOCOL_ADDRESS, amount: amount, note: noteText, role: 'Protocol' });
          });
        }
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
    loadingToastIdRef.current = toast.loading(`Executing your ${type}... Please check your wallet.`);

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time. Please try again.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);

      toast.success(`Your ${type} has been published!`, { id: loadingToastIdRef.current });
      setContent("");
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

  const hasNfd = !!nfd?.name;
  const canSubmit = !activeAddress || isLoading || nfdLoading || !hasNfd || !content.trim();

  return (
    <div className="mt-4 space-y-2">
      <InteractionCardInput
        type={type}
        placeholder={`Write a ${type}...`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={!activeAddress || isLoading || nfdLoading}
        onSubmit={handleSubmit}
        isSubmitDisabled={canSubmit}
      />
      {activeAddress && nfdLoading && (
        <p className="text-xs text-muted-foreground">Checking for NFD...</p>
      )}
      {activeAddress && !nfdLoading && !hasNfd && (
        <a href="https://app.nf.domains" target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 block hover:underline">
          You need an NFD to post a {type}. Get an Algorand Domain
        </a>
      )}

      <ReviewPreview content={content} type={type} />

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
    </div>
  );
}