"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { PROTOCOL_ADDRESS, getNextId, generateHash } from "@/lib/social";
import { Project, ProjectsData } from "@/types/social";
import { useNfd } from "@/hooks/useNfd";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { Skeleton } from "@/components/ui/skeleton";
import { ReviewPreview } from "./ReviewPreview";
import { InteractionCardInput } from "./InteractionCardInput";
import { PaymentConfirmationDialog } from "./PaymentConfirmationDialog";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { retryFetch } from "@/utils/api"; // Import retryFetch
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Import Card components
import { useLocation, useNavigate } from "react-router-dom"; // NEW
import { useTransactionDraft } from "@/hooks/useTransactionDraft"; // NEW

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";
const MAX_NOTE_SIZE_BYTES = 1024;
const TRANSACTION_TIMEOUT_MS = 60000; // 60 seconds timeout for wallet response
const PROMPT_TIMEOUT_MS = 5000; // 5 seconds for wallet prompt

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

interface NewReviewForExistingProjectFormProps {
  project: Project;
  projectsData: ProjectsData;
  onInteractionSuccess: () => void;
}

export function NewReviewForExistingProjectForm({ project, projectsData, onInteractionSuccess }: NewReviewForExistingProjectFormProps) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionsToConfirm, setTransactionsToConfirm] = useState<TransactionDisplayItem[]>([]);
  const [preparedAtc, setPreparedAtc] = useState<algosdk.AtomicTransactionComposer | null>(null);
  const loadingToastIdRef = useRef<string | null>(null);

  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { nfd, loading: nfdLoading } = useNfd(activeAddress);
  const { projectDetails, loading: detailsLoadingState, isRefreshing: detailsRefreshingState } = useProjectDetails();
  const { settings } = useSettings();
  const isProjectDetailsLoading = detailsLoadingState || detailsRefreshingState;
  
  const location = useLocation(); // NEW
  const navigate = useNavigate(); // NEW
  const { draft, saveDraft, clearDraft } = useTransactionDraft(); // NEW

  const currentProjectDetailsEntry = projectDetails.find(entry => entry.projectId === project.id);
  const projectName = useMemo(() => {
    return currentProjectDetailsEntry?.projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${project.id}`;
  }, [currentProjectDetailsEntry, project.id]);

  // NEW: Draft Restoration Logic
  useEffect(() => {
    // Check if we are explicitly resuming a draft AND the draft exists AND it's a review draft for this project
    if (location.state?.resumeDraft && draft && draft.address === activeAddress && draft.projectId === project.id) {
        const isContextMatch = draft.type === 'review';
        
        if (isContextMatch) {
            setContent(draft.content);
            // Clear the draft state from the router history state
            navigate(location.pathname, { replace: true, state: {} });
        } else {
            clearDraft();
        }
    }
  }, [location.state, draft, activeAddress, project.id, navigate, clearDraft]);


  const handleSubmit = async () => {
    const atc = await prepareTransactions();
    if (atc) {
      // NEW: Save draft before opening dialog or executing
      saveDraft({
        projectId: project.id,
        type: 'review',
        content: content,
      });

      if (settings.showTransactionConfirmation) {
        setIsDialogOpen(true);
      } else {
        await executeTransactions(atc);
      }
    }
  };

  const prepareTransactions = async (): Promise<algosdk.AtomicTransactionComposer | null> => {
    if (!activeAddress || !transactionSigner) {
      showError("Please connect your wallet to create a review.");
      return null;
    }
    if (!nfd?.name) {
      showError("You must have an NFD to post a review.");
      return null;
    }
    if (!content.trim()) {
      showError("Review content cannot be empty.");
      return null;
    }

    setIsLoading(true);
    const toastId = showLoading("Preparing your new review...");

    try {
      const indexerStatusResponse = await retryFetch(`${INDEXER_URL}/v2/transactions?limit=1`, undefined, 5); // Increased retries
      if (!indexerStatusResponse.ok) throw new Error("Could not fetch network status from Indexer.");
      const indexerStatusData = await indexerStatusResponse.json();
      const lastRound = indexerStatusData['current-round'];
      if (typeof lastRound !== 'number') throw new Error("Could not get last round from the network.");

      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      const projectId = project.id;
      const nextReviewId = getNextId(projectsData[projectId]?.reviews || {});
      const hash = generateHash(lastRound, activeAddress);
      const noteIdentifierBase = `${hash}.${projectId}.${nextReviewId}.1`;
      const noteIdentifierForSizing = `${noteIdentifierBase}.0 `;
      const availableSpace = MAX_NOTE_SIZE_BYTES - new TextEncoder().encode(noteIdentifierForSizing).length;
      const contentBytes = new TextEncoder().encode(content);
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < contentBytes.length; i += availableSpace) {
        chunks.push(contentBytes.subarray(i, i + availableSpace));
      }
      if (chunks.length > 16) throw new Error("Content is too long.");

      const displayItems: TransactionDisplayItem[] = [];
      chunks.forEach((chunk, index) => {
        const noteIdentifier = `${noteIdentifierBase}.${index}`;
        const noteText = `${noteIdentifier} ${new TextDecoder().decode(chunk)}`;
        const noteBytes = new TextEncoder().encode(noteText);
        const amount = index === 0 ? 1_000_000 : 0;
        const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: activeAddress, receiver: PROTOCOL_ADDRESS, amount, suggestedParams, note: noteBytes });
        atc.addTransaction({ txn: paymentTxn, signer: transactionSigner });
        displayItems.push({ type: 'pay', from: activeAddress, to: PROTOCOL_ADDRESS, amount: amount, note: noteText, role: 'Protocol' });
      });

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
    loadingToastIdRef.current = toast.loading("Executing your new review... Please check your wallet.");
    
    // NEW: Set short timer for wallet prompt
    const promptTimer = setTimeout(() => {
        toast.info("If the request didn't show up, reconnect your wallet and try again.", { duration: 10000 });
    }, PROMPT_TIMEOUT_MS);

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time. Please try again.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);

      clearTimeout(promptTimer); // Clear prompt timer on success
      clearDraft(); // NEW: Clear draft on success

      toast.success("Your new review has been published!", { id: loadingToastIdRef.current });
      setContent("");
      onInteractionSuccess();
    } catch (error) {
      clearTimeout(promptTimer); // Clear prompt timer on failure
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
  const canSubmit = !activeAddress || isLoading || nfdLoading || isProjectDetailsLoading || !hasNfd || !content.trim();

  return (
    <Card className="w-full max-w-3xl mt-8">
      <CardHeader>
        {isProjectDetailsLoading ? (
          <Skeleton className="h-7 w-3/4 mb-2" />
        ) : (
          <CardTitle>Write a Review for {projectName}</CardTitle>
        )}
        <CardDescription>
          Add a new review to this existing project.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <InteractionCardInput
          type="review"
          placeholder="Write your review or review here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={!activeAddress || isLoading || nfdLoading || isProjectDetailsLoading}
          onSubmit={handleSubmit}
          isSubmitDisabled={canSubmit}
        />
        {activeAddress && (nfdLoading || isProjectDetailsLoading) && (
          <p className="text-sm text-muted-foreground text-center">
            {nfdLoading ? "Checking for NFD..." : "Loading project details..."}
          </p>
        )}
        {activeAddress && !nfdLoading && !hasNfd && (
          <a href="https://app.nf.domains" target="_blank" rel="noopener noreferrer" className="text-sm text-red-400 text-center block hover:underline">
            You need an NFD to post a review. Get an Algorand Domain
          </a>
        )}

        <ReviewPreview content={content} type="review" />
      </CardContent>

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
            // NEW: If cancelled, clear draft if it exists
            clearDraft();
          }
        }}
        transactions={transactionsToConfirm}
        onConfirm={() => preparedAtc && executeTransactions(preparedAtc)}
        isConfirming={isConfirming}
      />
    </Card>
  );
}