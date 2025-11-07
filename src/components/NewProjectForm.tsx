"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import algosdk from "algosdk";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { PROTOCOL_ADDRESS, getNextId, generateHash } from "@/lib/social";
import { ProjectsData } from "@/types/social";
import { useNfd } from "@/hooks/useNfd";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { ReviewPreview } from "./ReviewPreview";
import { InteractionCardInput } from "./InteractionCardInput";
import { PaymentConfirmationDialog } from "./PaymentConfirmationDialog";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { retryFetch } from "@/utils/api";
import { MetadataItem } from '@/types/project';
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";
const MAX_NOTE_SIZE_BYTES = 1024;
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

interface NewProjectFormProps {
  projects: ProjectsData;
  onInteractionSuccess: () => void;
}

export function NewProjectForm({ projects, onInteractionSuccess }: NewProjectFormProps) {
  const [projectName, setProjectName] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [creatorWalletAddress, setCreatorWalletAddress] = useState("");
  const [projectWalletAddress, setProjectWalletAddress] = useState(""); // NEW: Project Wallet Address
  const [whitelistedEditors, setWhitelistedEditors] = useState("");
  const [projectTags, setProjectTags] = useState("");
  const [metadataItems, setMetadataItems] = useState<MetadataItem[]>([]);

  const [isCreator, setIsCreator] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionsToConfirm, setTransactionsToConfirm] = useState<TransactionDisplayItem[]>([]);
  const [preparedAtc, setPreparedAtc] = useState<algosdk.AtomicTransactionComposer | null>(null);
  const loadingToastIdRef = useRef<string | null>(null);

  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { nfd, loading: nfdLoading } = useNfd(activeAddress);
  const { updateProjectDetails } = useProjectDetails();
  const { settings } = useSettings();

  const handleAddMetadataItem = useCallback(() => {
    setMetadataItems(prev => [...prev, { title: '', value: '', type: 'text' }]);
  }, []);

  const handleUpdateMetadataItem = useCallback((index: number, field: keyof MetadataItem, value: string) => {
    setMetadataItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }, []);

  const handleUpdateMetadataType = useCallback((index: number, type: MetadataItem['type']) => {
    setMetadataItems(prev => prev.map((item, i) => i === index ? { ...item, type } : item));
  }, []);

  const handleRemoveMetadataItem = useCallback((index: number) => {
    setMetadataItems(prev => prev.filter((_, i) => i !== index));
  }, []);

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
      showError("Please connect your wallet to add a project.");
      return null;
    }
    if (!nfd?.name) {
      showError("You must have an NFD to add a new project.");
      return null;
    }
    if (!projectName.trim()) {
      showError("Project Name cannot be empty.");
      return null;
    }
    // Validation for Creator Wallet
    if (creatorWalletAddress.trim() && creatorWalletAddress.trim().length !== 58) {
      showError("Creator Wallet must be a valid 58-character Algorand address.");
      return null;
    }
    // NEW: Validation for Project Wallet
    if (projectWalletAddress.trim() && projectWalletAddress.trim().length !== 58) {
      showError("Project Wallet must be a valid 58-character Algorand address.");
      return null;
    }

    setIsLoading(true);
    const toastId = showLoading("Preparing your new project...");

    try {
      const indexerStatusResponse = await retryFetch(`${INDEXER_URL}/v2/transactions?limit=1`, undefined, 5); // Increased retries
      if (!indexerStatusResponse.ok) throw new Error("Could not fetch network status from Indexer.");
      const indexerStatusData = await indexerStatusResponse.json();
      const lastRound = indexerStatusData['current-round'];
      if (typeof lastRound !== 'number') throw new Error("Could not get last round from the network.");

      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      const newProjectId = getNextId(projects);
      const firstReviewId = "a";
      const hash = generateHash(lastRound, activeAddress);
      const noteIdentifierBase = `${hash}.${newProjectId}.${firstReviewId}.1`;
      const content = ""; // Initial review content is empty
      const noteIdentifierForSizing = `${noteIdentifierBase}.0 `;
      const availableSpace = MAX_NOTE_SIZE_BYTES - new TextEncoder().encode(noteIdentifierForSizing).length;
      const contentBytes = new TextEncoder().encode(content);
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < contentBytes.length; i += availableSpace) {
        chunks.push(contentBytes.subarray(i, i + availableSpace));
      }
      if (chunks.length === 0) chunks.push(new Uint8Array());
      if (chunks.length > 16) throw new Error("Content is too long.");

      const paymentAmount = isCreator ? 10_000_000 : 5_000_000;
      const displayItems: TransactionDisplayItem[] = [];

      chunks.forEach((chunk, index) => {
        const noteIdentifier = `${noteIdentifierBase}.${index}`;
        const noteText = `${noteIdentifier} ${new TextDecoder().decode(chunk)}`;
        const noteBytes = new TextEncoder().encode(noteText);
        const amount = index === 0 ? paymentAmount : 0;
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
    loadingToastIdRef.current = toast.loading("Executing your new project... Please check your wallet.");

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time. Please try again.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);

      const newProjectId = getNextId(projects);
      const parsedWhitelistedAddresses = whitelistedEditors.split(',').map(addr => addr.trim()).filter(Boolean);

      const fullProjectMetadata: MetadataItem[] = [
        { title: 'Project Name', value: projectName, type: 'project-name' },
        { title: 'Description', value: projectNotes, type: 'project-description' },
        { title: 'Tags', value: projectTags, type: 'tags' }, // Changed to 'Tags'
        { title: 'Whitelisted Editors', value: parsedWhitelistedAddresses.join(', '), type: 'whitelisted-editors' },
        { title: 'Is Creator Added', value: isCreator ? 'true' : 'false', type: 'is-creator-added' },
        { title: 'Added By Address', value: activeAddress!, type: 'added-by-address' },
        { title: 'Is Community Notes', value: 'false', type: 'is-community-notes' },
        { title: 'Is Claimed', value: 'false', type: 'is-claimed' }, // NEW: Default to unclaimed
        // Add Creator Wallet Address if provided
        ...(creatorWalletAddress.trim() ? [{ title: 'Creator Wallet', value: creatorWalletAddress.trim(), type: 'address' as const }] : []),
        // NEW: Add Project Wallet Address if provided
        ...(projectWalletAddress.trim() ? [{ title: 'Project Wallet', value: projectWalletAddress.trim(), type: 'project-wallet' as const }] : []),
        ...metadataItems.filter(item => item.title.trim() && item.value.trim()).map(item => ({
          ...item,
          type: item.type || 'text'
        }))
      ];

      // NEW: If an asset-id is present in dynamic metadata, try to fetch its unit-name
      const assetIdItem = fullProjectMetadata.find(item => item.type === 'asset-id');
      if (assetIdItem && assetIdItem.value) {
        try {
          const assetIdNum = parseInt(assetIdItem.value, 10);
          if (!isNaN(assetIdNum) && assetIdNum > 0) {
            const response = await retryFetch(`${INDEXER_URL}/v2/assets/${assetIdNum}`, undefined, 5); // Increased retries
            if (response.ok) {
              const data = await response.json();
              const unitName = data.asset.params['unit-name'];
              if (unitName) {
                fullProjectMetadata.push({ title: 'Asset Unit Name', value: unitName, type: 'asset-unit-name' });
              }
            }
          }
        } catch (e) {
          console.error("Failed to fetch asset unit name for new project:", e);
        }
      }

      await updateProjectDetails(newProjectId, fullProjectMetadata);
      toast.success("Your new project has been added!", { id: loadingToastIdRef.current });
      setProjectName("");
      setProjectNotes("");
      setCreatorWalletAddress(""); // Clear new field
      setProjectWalletAddress(""); // Clear new field
      setWhitelistedEditors("");
      setProjectTags(""); // Clear projectTags
      setMetadataItems([]);
      setIsCreator(false);
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
  const isCreatorWalletValid = !creatorWalletAddress.trim() || creatorWalletAddress.trim().length === 58;
  const isProjectWalletValid = !projectWalletAddress.trim() || projectWalletAddress.trim().length === 58; // NEW validation
  const canSubmit = !activeAddress || isLoading || nfdLoading || !hasNfd || !projectName.trim() || !isCreatorWalletValid || !isProjectWalletValid; // Updated canSubmit
  const inputDisabled = !activeAddress || isLoading || nfdLoading;

  return (
    <div className="relative w-full max-w-md p-10 bg-hodl-darker box-border shadow-[0_15px_25px_rgba(0,0,0,0.6)] rounded-lg">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div className="relative user-box">
          <Input
            id="projectName"
            placeholder="" // Placeholder is handled by label
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            disabled={inputDisabled}
            className="peer w-full py-2 text-base text-white mb-[30px] border-none border-b border-white outline-none bg-transparent focus:border-b-[#03f40f] focus:outline-none focus:ring-0"
            // Removed 'required' attribute
          />
          <Label
            htmlFor="projectName"
            className="absolute top-0 left-0 py-2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:top-[-20px] peer-focus:left-0 peer-focus:text-[#bdb8b8] peer-focus:text-xs peer-valid:top-[-20px] peer-valid:left-0 peer-valid:text-[#bdb8b8] peer-valid:text-xs peer-focus:bg-hodl-darker peer-focus:px-1 peer-valid:bg-hodl-darker peer-valid:px-1"
          >
            Project Name
          </Label>
        </div>

        <div className="flex items-center space-x-2 mb-[30px]">
          <Checkbox
            id="isCreator"
            checked={isCreator}
            onCheckedChange={(checked) => setIsCreator(!!checked)}
            disabled={inputDisabled}
            className="border-white data-[state=checked]:bg-[#03f40f] data-[state=checked]:text-white"
          />
          <Label htmlFor="isCreator" className="text-white text-sm">I'm this Project's Creator</Label>
        </div>

        <div className="relative user-box">
          <Input
            id="creatorWalletAddress"
            placeholder=""
            value={creatorWalletAddress}
            onChange={(e) => setCreatorWalletAddress(e.target.value)}
            disabled={inputDisabled}
            className="peer w-full py-2 text-base text-white mb-[30px] border-none border-b border-white outline-none bg-transparent focus:border-b-[#03f40f] focus:outline-none focus:ring-0"
          />
          <Label
            htmlFor="creatorWalletAddress"
            className="absolute top-0 left-0 py-2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:top-[-20px] peer-focus:left-0 peer-focus:text-[#bdb8b8] peer-focus:text-xs peer-valid:top-[-20px] peer-valid:left-0 peer-valid:text-[#bdb8b8] peer-valid:text-xs peer-focus:bg-hodl-darker peer-focus:px-1 peer-valid:bg-hodl-darker peer-valid:px-1"
          >
            Creator Wallet Address (Algorand Address)
          </Label>
          {creatorWalletAddress.trim() && creatorWalletAddress.trim().length !== 58 && (
            <p className="text-xs text-red-500 mt-1">Must be a valid 58-character Algorand address.</p>
          )}
        </div>

        {/* NEW: Project Wallet Address */}
        <div className="relative user-box">
          <Input
            id="projectWalletAddress"
            placeholder=""
            value={projectWalletAddress}
            onChange={(e) => setProjectWalletAddress(e.target.value)}
            disabled={inputDisabled}
            className="peer w-full py-2 text-base text-white mb-[30px] border-none border-b border-white outline-none bg-transparent focus:border-b-[#03f40f] focus:outline-none focus:ring-0"
          />
          <Label
            htmlFor="projectWalletAddress"
            className="absolute top-0 left-0 py-2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:top-[-20px] peer-focus:left-0 peer-focus:text-[#bdb8b8] peer-focus:text-xs peer-valid:top-[-20px] peer-valid:left-0 peer-valid:text-[#bdb8b8] peer-valid:text-xs peer-focus:bg-hodl-darker peer-focus:px-1 peer-valid:bg-hodl-darker peer-valid:px-1"
          >
            Project Wallet Address (Algorand Address, Optional)
          </Label>
          {projectWalletAddress.trim() && projectWalletAddress.trim().length !== 58 && (
            <p className="text-xs text-red-500 mt-1">Must be a valid 58-character Algorand address.</p>
          )}
        </div>
        {/* END NEW */}

        <div className="relative user-box mb-[30px]">
          <Input
            id="projectTags"
            placeholder=""
            value={projectTags}
            onChange={(e) => setProjectTags(e.target.value)}
            disabled={inputDisabled}
            className="peer w-full py-2 text-base text-white border-none border-b border-white outline-none bg-transparent focus:border-b-[#03f40f] focus:outline-none focus:ring-0"
          />
          <Label
            htmlFor="projectTags"
            className="absolute top-0 left-0 py-2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:top-[-20px] peer-focus:left-0 peer-focus:text-[#bdb8b8] peer-focus:text-xs peer-valid:top-[-20px] peer-valid:left-0 peer-valid:text-[#bdb8b8] peer-valid:text-xs peer-focus:bg-hodl-darker peer-focus:px-1 peer-valid:bg-hodl-darker peer-valid:px-1"
          >
            Tags (comma-separated)
          </Label>
        </div>

        <div className="relative user-box">
          <InteractionCardInput
            type="notes"
            id="projectNotes"
            placeholder=""
            value={projectNotes}
            onChange={(e) => setProjectNotes(e.target.value)}
            disabled={inputDisabled}
            onSubmit={handleSubmit}
            isSubmitDisabled={true} // Ensure submit button is disabled for this field
            className="peer w-full py-2 text-base text-white mb-[30px] border-none border-b border-white outline-none bg-transparent focus:border-b-[#03f40f] focus:outline-none focus:ring-0 min-h-[80px]"
          />
          <Label
            htmlFor="projectNotes"
            className="absolute top-0 left-0 py-2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:top-[-20px] peer-focus:left-0 peer-focus:text-[#bdb8b8] peer-focus:text-xs peer-valid:top-[-20px] peer-valid:left-0 peer-valid:text-[#bdb8b8] peer-valid:text-xs peer-focus:bg-hodl-darker peer-focus:px-1 peer-valid:bg-hodl-darker peer-valid:px-1"
          >
            {isCreator ? "Creator Notes" : "Contributor Notes"}
          </Label>
        </div>

        <div className="relative user-box">
          <Input
            id="whitelistedEditors"
            placeholder=""
            value={whitelistedEditors}
            onChange={(e) => setWhitelistedEditors(e.target.value)}
            disabled={inputDisabled}
            className="peer w-full py-2 text-base text-white mb-[30px] border-none border-b border-white outline-none bg-transparent focus:border-b-[#03f40f] focus:outline-none focus:ring-0"
          />
          <Label
            htmlFor="whitelistedEditors"
            className="absolute top-0 left-0 py-2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:top-[-20px] peer-focus:left-0 peer-focus:text-[#bdb8b8] peer-focus:text-xs peer-valid:top-[-20px] peer-valid:left-0 peer-valid:text-[#bdb8b8] peer-valid:text-xs peer-focus:bg-hodl-darker peer-focus:px-1 peer-valid:bg-hodl-darker peer-valid:px-1"
          >
            Whitelisted Editors (comma-separated)
          </Label>
        </div>

        {/* Dynamic Metadata Fields */}
        <div className="space-y-4 mb-[30px]">
          <h3 className="text-lg font-semibold text-white">Additional Metadata</h3>
          {metadataItems.map((item, index) => (
            <div key={index} className="flex flex-col sm:flex-row items-end gap-2">
              <div className="flex-1 relative user-box w-full">
                <Input
                  id={`metadata-title-${index}`}
                  placeholder=""
                  value={item.title}
                  onChange={(e) => handleUpdateMetadataItem(index, 'title', e.target.value)}
                  disabled={inputDisabled}
                  className="peer w-full py-2 text-base text-white border-none border-b border-white outline-none bg-transparent focus:border-b-[#03f40f] focus:outline-none focus:ring-0"
                />
                <Label
                  htmlFor={`metadata-title-${index}`}
                  className="absolute top-0 left-0 py-2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:top-[-20px] peer-focus:left-0 peer-focus:text-[#bdb8b8] peer-focus:text-xs peer-valid:top-[-20px] peer-valid:left-0 peer-valid:text-[#bdb8b8] peer-valid:text-xs peer-focus:bg-hodl-darker peer-focus:px-1 peer-valid:bg-hodl-darker peer-valid:px-1"
                >
                  Title
                </Label>
              </div>
              <div className="flex-1 relative user-box w-full">
                <Input
                  id={`metadata-value-${index}`}
                  placeholder=""
                  value={item.value}
                  onChange={(e) => handleUpdateMetadataItem(index, 'value', e.target.value)}
                  disabled={inputDisabled}
                  className="peer w-full py-2 text-base text-white border-none border-b border-white outline-none bg-transparent focus:border-b-[#03f40f] focus:outline-none focus:ring-0"
                />
                <Label
                  htmlFor={`metadata-value-${index}`}
                  className="absolute top-0 left-0 py-2 text-base text-white pointer-events-none transition-all duration-500 peer-focus:top-[-20px] peer-focus:left-0 peer-focus:text-[#bdb8b8] peer-focus:text-xs peer-valid:top-[-20px] peer-valid:left-0 peer-valid:text-[#bdb8b8] peer-valid:text-xs peer-focus:bg-hodl-darker peer-focus:px-1 peer-valid:bg-hodl-darker peer-valid:px-1"
                >
                  Value
                </Label>
              </div>
              <div className="w-full sm:w-[150px] relative user-box">
                <Label htmlFor={`metadata-type-${index}`} className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Type</Label>
                <Select
                  value={item.type || 'text'}
                  onValueChange={(value: MetadataItem['type']) => handleUpdateMetadataType(index, value)}
                  disabled={inputDisabled}
                >
                  <SelectTrigger id={`metadata-type-${index}`} className="w-full py-2 text-base text-white border-none border-b border-white outline-none bg-transparent focus:border-b-[#03f40f] focus:outline-none focus:ring-0">
                    <SelectValue placeholder="Select type" className="text-white" />
                  </SelectTrigger>
                  <SelectContent className="bg-hodl-darker text-white border-border">
                    <SelectItem value="text" className="hover:bg-muted/50">Text</SelectItem>
                    <SelectItem value="url" className="hover:bg-muted/50">URL</SelectItem>
                    <SelectItem value="x-url" className="hover:bg-muted/50">X (Twitter) URL</SelectItem>
                    <SelectItem value="asset-id" className="hover:bg-muted/50">Asset ID</SelectItem>
                    <SelectItem value="address" className="hover:bg-muted/50">Address</SelectItem>
                    <SelectItem value="asset-unit-name" className="hover:bg-muted/50">Asset Unit Name</SelectItem> {/* NEW */}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveMetadataItem(index)}
                disabled={inputDisabled}
                className="text-destructive hover:text-destructive/90"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={handleAddMetadataItem}
            disabled={inputDisabled}
            className="w-full mt-2 bg-transparent text-white hover:bg-white/10 border-white"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Add Metadata Field
          </Button>
        </div>

        {activeAddress && nfdLoading && (
          <p className="text-sm text-muted-foreground text-center mb-4">Checking for NFD...</p>
        )}
        {activeAddress && !nfdLoading && !hasNfd && (
          <a href="https://app.nf.domains" target="_blank" rel="noopener noreferrer" className="text-sm text-red-400 text-center block hover:underline mb-4">
            You need an NFD to add a project. Get an Algorand Domain
          </a>
        )}
        <ReviewPreview content={projectNotes} type="notes" className="mb-4" />

        <center>
          <button type="submit" disabled={canSubmit} className="relative inline-block py-2.5 px-5 text-white text-base uppercase overflow-hidden transition-all duration-500 mt-10 tracking-[4px] hover:bg-[#03f40f] hover:text-white hover:rounded-md hover:shadow-[0_0_5px_#03f40f,0_0_25px_#03f40f,0_0_50px_#03f40f,0_0_100px_#03f40f] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-transparent">
            {isLoading ? "SENDING..." : "SEND"}
            <span className="absolute block bottom-[2px] left-[-100%] w-full h-[2px] bg-gradient-to-r from-transparent to-[#03f40f] animate-[btn-anim1_2s_linear_infinite]"></span>
          </button>
        </center>
      </form>

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