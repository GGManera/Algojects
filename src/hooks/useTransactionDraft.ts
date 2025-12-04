"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { MetadataItem } from '@/types/project'; // Import MetadataItem for type safety

export interface TransactionDraft {
  address: string; // Wallet address that created the draft
  projectId: string;
  type: 'review' | 'comment' | 'reply' | 'project' | 'metadata-suggestion';
  content: string;
  parentReviewId?: string;
  parentCommentId?: string;
  // For project/metadata:
  metadataDraft?: {
    projectName?: string;
    projectNotes?: string;
    creatorWalletAddress?: string;
    projectWalletAddress?: string;
    whitelistedEditors?: string;
    projectTags?: string;
    metadataItems?: MetadataItem[];
    isCreator?: boolean;
  };
  // For metadata suggestion:
  initialMetadataItem?: MetadataItem; // The item being edited (if applicable)
}

const DRAFT_STORAGE_KEY = 'algojects_transaction_draft';

function useTransactionDraft() {
  const [draft, setDraft] = useState<TransactionDraft | null>(null);
  const { activeAddress } = useWallet();

  // Load draft from storage on mount or when activeAddress changes
  useEffect(() => {
    const storedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (storedDraft) {
      try {
        const parsedDraft: TransactionDraft = JSON.parse(storedDraft);
        
        // Only load if the address matches the currently active address
        if (parsedDraft.address === activeAddress) {
          setDraft(parsedDraft);
        } else {
          // If address doesn't match, clear stale draft (or keep it if activeAddress is null)
          if (activeAddress) {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            setDraft(null);
          } else {
            // Keep the draft in storage if no wallet is connected, but don't set it to state yet
            setDraft(null);
          }
        }
      } catch (e) {
        console.error("Failed to parse transaction draft:", e);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setDraft(null);
      }
    } else {
        setDraft(null);
    }
  }, [activeAddress]);

  const saveDraft = useCallback((newDraft: Omit<TransactionDraft, 'address'>) => {
    if (!activeAddress) return;
    const fullDraft: TransactionDraft = { ...newDraft, address: activeAddress };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(fullDraft));
    setDraft(fullDraft);
  }, [activeAddress]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraft(null);
  }, []);

  return { draft, saveDraft, clearDraft };
}

export { useTransactionDraft };