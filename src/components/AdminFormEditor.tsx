"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { FormStructure, generateHash, verifyTransactionAndCommit, generateLocalHash } from '@/lib/feedback-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@txnlab/use-wallet-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Edit, Hash, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import algosdk from 'algosdk';
import { toast } from 'sonner';
import { PaymentConfirmationDialog } from './PaymentConfirmationDialog';

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

interface AdminFormEditorProps {
  currentSchema: FormStructure;
  onSchemaUpdate: () => void;
}

export function AdminFormEditor({ currentSchema, onSchemaUpdate }: AdminFormEditorProps) {
  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const [draftJson, setDraftJson] = useState(JSON.stringify(currentSchema, null, 2));
  const [isJsonValid, setIsJsonValid] = useState(true);
  const [generatedHash, setGeneratedHash] = useState<string | null>(null);
  const [txId, setTxId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  
  // Transaction states
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [transactionsToConfirm, setTransactionsToConfirm] = useState<TransactionDisplayItem[]>([]);
  const [preparedAtc, setPreparedAtc] = useState<algosdk.AtomicTransactionComposer | null>(null);
  const loadingToastIdRef = React.useRef<string | number | null>(null);

  const adminWallet = import.meta.env.VITE_FEEDBACK_ADMIN_WALLET;
  const projectWallet = import.meta.env.VITE_FEEDBACK_PROJECT_WALLET;

  const isAuthorized = useMemo(() => {
    return activeAddress === adminWallet;
  }, [activeAddress, adminWallet]);

  const parsedDraft = useMemo(() => {
    try {
      const parsed = JSON.parse(draftJson);
      setIsJsonValid(true);
      return parsed;
    } catch (e) {
      setIsJsonValid(false);
      return null;
    }
  }, [draftJson]);

  useEffect(() => {
    // Reset draft when currentSchema changes (e.g., after a successful commit)
    setDraftJson(JSON.stringify(currentSchema, null, 2));
    setGeneratedHash(null);
    setTxId('');
  }, [currentSchema]);

  const handleGenerateHash = async () => {
    if (!parsedDraft || !isJsonValid) {
      showError("Invalid JSON draft.");
      return;
    }
    setIsGenerating(true);
    try {
      // Update audit fields locally before hashing
      const updatedDraft = {
        ...parsedDraft,
        audit: {
          last_edit: {
            hash: null, // Hash is generated *after* this step
            txid: null,
            editor_wallet: activeAddress,
            timestamp: new Date().toISOString(),
          }
        }
      } as FormStructure;
      
      // Re-stringify the updated draft to ensure the hash is correct
      const { hash, normalizedJsonString } = await generateHash(updatedDraft);
      
      // Update the draft JSON state with the normalized, audited version
      setDraftJson(JSON.stringify(updatedDraft, Object.keys(updatedDraft).sort(), 2));
      setGeneratedHash(hash);
      showSuccess("Hash generated successfully. Proceed to sign transaction.");
    } catch (error) {
      console.error(error);
      showError(error instanceof Error ? error.message : "Failed to generate hash.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrepareTransaction = async () => {
    if (!generatedHash) {
      showError("Please generate the hash first.");
      return;
    }
    if (!activeAddress || !transactionSigner || !algodClient) {
      showError("Wallet not connected.");
      return;
    }
    
    setIsCommitting(true);
    const toastId = showLoading("Preparing verification transaction...");

    try {
      const atc = new algosdk.AtomicTransactionComposer();
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // 0 ALGO payment to the project wallet (or admin wallet if they are the same)
      const receiver = projectWallet || adminWallet;
      const noteText = `AlgoJects Form Schema Update Hash: ${generatedHash}`;
      const noteBytes = new TextEncoder().encode(noteText);
      
      const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ 
          sender: activeAddress, 
          receiver: receiver, 
          amount: 0, 
          suggestedParams, 
          note: noteBytes 
      });
      atc.addTransaction({ txn: paymentTxn, signer: transactionSigner });
      
      const displayItems: TransactionDisplayItem[] = [{ 
          type: 'pay', 
          from: activeAddress, 
          to: receiver, 
          amount: 0, 
          note: noteText, 
          role: 'Schema Update Proof' 
      }];

      dismissToast(toastId);
      setPreparedAtc(atc);
      setTransactionsToConfirm(displayItems);
      setIsPaymentDialogOpen(true);
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "An unknown error occurred during transaction preparation.");
      setIsCommitting(false);
    }
  };

  const executeTransaction = async (atcToExecute: algosdk.AtomicTransactionComposer) => {
    if (!atcToExecute || !algodClient) {
      showError("Transaction composer not prepared.");
      return;
    }

    setIsVerifying(true);
    loadingToastIdRef.current = toast.loading("Executing transaction... Please check your wallet.");

    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error("Wallet did not respond in time.")), TRANSACTION_TIMEOUT_MS)
    );

    try {
      const result = await Promise.race([atcToExecute.execute(algodClient, 4), timeoutPromise]);
      const confirmedTxId = result.txIDs[0];
      
      toast.info(`Transaction confirmed. Verifying hash on server...`, { id: loadingToastIdRef.current });
      
      // Now, verify the transaction hash and commit the schema
      await handleVerifyAndCommit(confirmedTxId);
      
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "An unknown error occurred during execution.", { id: loadingToastIdRef.current });
    } finally {
      setIsPaymentDialogOpen(false);
      setIsVerifying(false);
      setIsCommitting(false);
      setPreparedAtc(null);
      setTransactionsToConfirm([]);
      loadingToastIdRef.current = null;
    }
  };
  
  const handleVerifyAndCommit = async (confirmedTxId: string) => {
    if (!generatedHash || !parsedDraft) return;
    
    setIsVerifying(true);
    loadingToastIdRef.current = toast.loading("Finalizing update and committing to Coda...", { id: loadingToastIdRef.current });

    try {
        // Update the audit log in the draft with the confirmed TXID
        const finalDraft = {
            ...parsedDraft,
            audit: {
                last_edit: {
                    ...parsedDraft.audit.last_edit,
                    hash: generatedHash,
                    txid: confirmedTxId,
                }
            }
        } as FormStructure;
        
        // Verify the transaction and commit the final draft
        await verifyTransactionAndCommit(confirmedTxId, generatedHash, finalDraft);
        
        dismissToast(loadingToastIdRef.current);
        showSuccess("Form schema updated and verified on-chain!");
        onSchemaUpdate(); // Trigger parent refetch
    } catch (error) {
        dismissToast(loadingToastIdRef.current);
        console.error(error);
        showError(error instanceof Error ? error.message : "Failed to verify transaction or commit changes.");
    } finally {
        setIsVerifying(false);
    }
  };

  return (
    <>
      <Card className="w-full max-w-3xl mx-auto mt-8 bg-card border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Edit className="h-5 w-5" /> Dynamic Form Editor
          </CardTitle>
          <CardDescription>
            Edit the master JSON schema. Changes must be verified via an Algorand transaction signed by the authorized wallet ({adminWallet}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAuthorized && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unauthorized</AlertTitle>
              <AlertDescription>You must connect the authorized wallet ({adminWallet}) to edit the schema.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="json-draft">Master JSON Schema Draft</Label>
            <Textarea
              id="json-draft"
              value={draftJson}
              onChange={(e) => setDraftJson(e.target.value)}
              rows={20}
              disabled={!isAuthorized || isGenerating || isVerifying || isCommitting}
              className={`font-mono text-xs bg-muted/50 ${!isJsonValid ? 'border-red-500' : ''}`}
            />
            {!isJsonValid && <p className="text-red-500 text-sm">Invalid JSON format.</p>}
          </div>

          <div className="flex justify-between items-center pt-4">
            <Button 
              onClick={handleGenerateHash} 
              disabled={!isAuthorized || !isJsonValid || isGenerating || isVerifying || isCommitting}
              className="bg-hodl-blue hover:bg-hodl-blue/90"
            >
              <Hash className="h-4 w-4 mr-2" /> 
              {isGenerating ? "Generating..." : "1. Generate Hash"}
            </Button>
            
            {generatedHash && (
              <div className="text-sm font-mono text-muted-foreground truncate max-w-[50%]">
                Hash: <span className="text-primary font-bold">{generatedHash.substring(0, 10)}...</span>
              </div>
            )}
          </div>

          {generatedHash && (
            <div className="space-y-4 pt-4 border-t border-muted mt-4">
              <p className="text-sm text-muted-foreground">
                2. Sign a 0 ALGO transaction to the project wallet ({projectWallet}) containing the full hash in the note field.
              </p>
              
              <Button 
                onClick={handlePrepareTransaction} 
                disabled={!isAuthorized || isVerifying || isCommitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isCommitting ? "Waiting for Wallet..." : "2. Sign Transaction"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
          
          {/* The verification step is now handled automatically after signing */}
          
          {currentSchema.audit.last_edit.hash && (
            <div className="pt-4 border-t border-muted mt-4 text-sm">
              <h4 className="font-semibold text-primary">Last Verified Update:</h4>
              <p className="text-muted-foreground">Hash: {currentSchema.audit.last_edit.hash.substring(0, 10)}...</p>
              <p className="text-muted-foreground">TXID: <a href={`https://algoexplorer.io/tx/${currentSchema.audit.last_edit.txid}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{currentSchema.audit.last_edit.txid?.substring(0, 10)}...</a></p>
              <p className="text-muted-foreground">Timestamp: {new Date(currentSchema.audit.last_edit.timestamp || '').toLocaleString()}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <PaymentConfirmationDialog
        isOpen={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open);
          if (!open) {
            setIsCommitting(false);
            setIsVerifying(false);
          }
        }}
        transactions={transactionsToConfirm}
        onConfirm={() => preparedAtc && executeTransaction(preparedAtc)}
        isConfirming={isVerifying}
      />
    </>
  );
}