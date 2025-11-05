"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FormStructure, generateHash, verifyTransactionAndCommit, generateLocalHash } from '@/lib/feedback-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@txnlab/use-wallet-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Edit, Hash, CheckCircle, ArrowRight, AlertTriangle, PlusCircle, Settings } from 'lucide-react';
import algosdk from 'algosdk';
import { toast } from 'sonner';
import { PaymentConfirmationDialog } from './PaymentConfirmationDialog';
import { ModuleEditor } from './ModuleEditor'; // NEW Import
import { cn } from '@/lib/utils';

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
  const [editingMode, setEditingMode] = useState<'structured' | 'json'>('structured');
  
  // State for structured editing
  const [structuredDraft, setStructuredDraft] = useState<FormStructure>(currentSchema);
  
  // State for JSON editing (synced with structuredDraft)
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(currentSchema, null, 2));
  
  const [isJsonValid, setIsJsonValid] = useState(true);
  const [generatedHash, setGeneratedHash] = useState<string | null>(null);
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

  // --- Sync Effects ---

  // 1. Sync currentSchema -> structuredDraft on initial load/commit
  useEffect(() => {
    setStructuredDraft(currentSchema);
    setJsonDraft(JSON.stringify(currentSchema, null, 2));
    setGeneratedHash(null);
  }, [currentSchema]);

  // 2. Sync structuredDraft -> jsonDraft whenever structuredDraft changes
  useEffect(() => {
    try {
      setJsonDraft(JSON.stringify(structuredDraft, null, 2));
      setIsJsonValid(true);
    } catch (e) {
      // Should not happen if structured editing is used
      console.error("Error syncing structuredDraft to jsonDraft:", e);
    }
  }, [structuredDraft]);

  // 3. Sync jsonDraft -> structuredDraft when switching from JSON mode
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newJson = e.target.value;
    setJsonDraft(newJson);
    try {
      const parsed = JSON.parse(newJson);
      setStructuredDraft(parsed);
      setIsJsonValid(true);
    } catch (e) {
      setIsJsonValid(false);
    }
  };

  // --- Structured Editing Handlers ---
  const handleUpdateModule = useCallback((index: number, updatedModule: any) => {
    setStructuredDraft(prev => ({
      ...prev,
      modules: prev.modules.map((m, i) => i === index ? updatedModule : m)
    }));
  }, []);

  const handleRemoveModule = useCallback((index: number) => {
    setStructuredDraft(prev => ({
      ...prev,
      modules: prev.modules.filter((_, i) => i !== index)
    }));
  }, []);

  const handleAddModule = useCallback(() => {
    const newModule = {
      id: `m${Date.now()}`,
      title: 'New Module',
      description: 'New module description.',
      questions: [],
    };
    setStructuredDraft(prev => ({
      ...prev,
      modules: [...prev.modules, newModule]
    }));
  }, []);
  
  const handleUpdateMetadata = useCallback((key: keyof FormStructure['metadata'], value: string) => {
    setStructuredDraft(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [key]: value }
    }));
  }, []);

  // --- Core Logic ---

  const parsedDraft = useMemo(() => {
    try {
      return JSON.parse(jsonDraft);
    } catch {
      return null;
    }
  }, [jsonDraft]);

  const handleGenerateHash = async () => {
    const draftToHash = editingMode === 'json' ? parsedDraft : structuredDraft;

    if (!draftToHash || !isJsonValid) {
      showError("Invalid JSON draft.");
      return;
    }
    setIsGenerating(true);
    try {
      // Update audit fields locally before hashing
      const updatedDraft = {
        ...draftToHash,
        audit: {
          last_edit: {
            hash: null, // Hash is generated *after* this step
            txid: null,
            editor_wallet: activeAddress,
            timestamp: new Date().toISOString(),
          }
        }
      } as FormStructure;
      
      // Generate hash using the serverless function
      const { hash, normalizedJsonString } = await generateHash(updatedDraft);
      
      // Update the draft state with the normalized, audited version
      const finalDraft = JSON.parse(normalizedJsonString);
      setStructuredDraft(finalDraft);
      setJsonDraft(JSON.stringify(finalDraft, null, 2));
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
    if (!generatedHash || !structuredDraft) return;
    
    setIsVerifying(true);
    loadingToastIdRef.current = toast.loading("Finalizing update and committing to Coda...", { id: loadingToastIdRef.current });

    try {
        // Update the audit log in the draft with the confirmed TXID
        const finalDraft = {
            ...structuredDraft,
            audit: {
                last_edit: {
                    ...structuredDraft.audit.last_edit,
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Edit className="h-5 w-5" /> Dynamic Form Editor
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setEditingMode(prev => prev === 'structured' ? 'json' : 'structured')}
            disabled={!isAuthorized || isGenerating || isVerifying || isCommitting}
          >
            {editingMode === 'structured' ? 'Edit JSON' : 'Edit Structured'}
            <Settings className="h-4 w-4 ml-2" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAuthorized && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unauthorized</AlertTitle>
              <AlertDescription>You must connect the authorized wallet ({adminWallet}) to edit the schema.</AlertDescription>
            </Alert>
          )}

          {/* Metadata Editor */}
          <div className="space-y-2 p-4 border rounded-lg bg-muted/20">
            <h3 className="text-lg font-semibold text-primary">Form Metadata</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="form-id">Form ID</Label>
                    <Input id="form-id" value={structuredDraft.form_id} disabled className="bg-card" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="feedback-version">Feedback Version</Label>
                    <Input id="feedback-version" value={structuredDraft.feedback_version} disabled className="bg-card" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea 
                        id="description" 
                        value={structuredDraft.metadata.description} 
                        onChange={(e) => handleUpdateMetadata('description', e.target.value)}
                        disabled={!isAuthorized || isGenerating || isVerifying || isCommitting}
                        className="bg-card"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="admin-wallet">Admin Wallet</Label>
                    <Input id="admin-wallet" value={structuredDraft.authorized_wallet} disabled className="bg-card font-mono text-xs" />
                    <Label htmlFor="project-wallet">Project Wallet</Label>
                    <Input id="project-wallet" value={structuredDraft.project_wallet} disabled className="bg-card font-mono text-xs" />
                </div>
            </div>
          </div>

          {editingMode === 'structured' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary">Modules</h3>
              {structuredDraft.modules.map((module, index) => (
                <ModuleEditor
                  key={module.id} // Use module.id as the key
                  module={module}
                  index={index}
                  onUpdate={handleUpdateModule}
                  onRemove={handleRemoveModule}
                />
              ))}
              <Button onClick={handleAddModule} className="w-full" disabled={!isAuthorized || isGenerating || isVerifying || isCommitting}>
                <PlusCircle className="h-4 w-4 mr-2" /> Add New Module
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="json-draft">Master JSON Schema Draft</Label>
              <Textarea
                id="json-draft"
                value={jsonDraft}
                onChange={handleJsonChange}
                rows={20}
                disabled={!isAuthorized || isGenerating || isVerifying || isCommitting}
                className={cn("font-mono text-xs bg-muted/50", !isJsonValid && 'border-red-500')}
              />
              {!isJsonValid && <p className="text-red-500 text-sm">Invalid JSON format.</p>}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-muted">
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