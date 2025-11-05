"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FormStructure, updateFormStructureClient, generateLocalHash } from '@/lib/feedback-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@txnlab/use-wallet-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Edit, Hash, CheckCircle, ArrowRight, AlertTriangle, PlusCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { ModuleEditor } from './ModuleEditor';
import { cn } from '@/lib/utils';

interface AdminFormEditorProps {
  currentSchema: FormStructure;
  onSchemaUpdate: () => void;
}

export function AdminFormEditor({ currentSchema, onSchemaUpdate }: AdminFormEditorProps) {
  const { activeAddress } = useWallet();
  const [editingMode, setEditingMode] = useState<'structured' | 'json'>('structured');
  
  // State for structured editing
  const [structuredDraft, setStructuredDraft] = useState<FormStructure>(currentSchema);
  
  // State for JSON editing (synced with structuredDraft)
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(currentSchema, null, 2));
  
  const [isJsonValid, setIsJsonValid] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  
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

  // --- Core Logic: Direct Commit ---

  const handleCommitChanges = async () => {
    const draftToCommit = editingMode === 'json' ? structuredDraft : structuredDraft;

    if (!draftToCommit || !isJsonValid || !currentSchema.rowId) {
      showError("Invalid draft or missing Coda Row ID.");
      return;
    }
    
    setIsCommitting(true);
    const toastId = showLoading("Committing changes directly to Coda...");

    try {
      // 1. Generate local hash and update audit fields
      const localHash = generateLocalHash(draftToCommit);
      
      const finalDraft: FormStructure = {
        ...draftToCommit,
        audit: {
          last_edit: {
            hash: localHash,
            txid: 'LOCAL_COMMIT', // Mark as local commit
            editor_wallet: activeAddress || 'unconnected',
            timestamp: new Date().toISOString(),
          }
        }
      };
      
      // 2. Commit the final draft using the client API
      await updateFormStructureClient(finalDraft, currentSchema.rowId);
      
      dismissToast(toastId);
      showSuccess("Form schema updated successfully!");
      onSchemaUpdate(); // Trigger parent refetch
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "Failed to commit changes to Coda.");
    } finally {
      setIsCommitting(false);
    }
  };

  const parsedDraft = useMemo(() => {
    try {
      return JSON.parse(jsonDraft);
    } catch {
      return null;
    }
  }, [jsonDraft]);
  
  const canCommit = isAuthorized && isJsonValid && !isCommitting;

  return (
    <>
      <Card className="w-full max-w-3xl mx-auto mt-8 bg-card border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Edit className="h-5 w-5" /> Dynamic Form Editor (Admin Mode)
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setEditingMode(prev => prev === 'structured' ? 'json' : 'structured')}
            disabled={!isAuthorized || isCommitting}
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
                        disabled={!isAuthorized || isCommitting}
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
                  key={module.id}
                  module={module}
                  index={index}
                  onUpdate={handleUpdateModule}
                  onRemove={handleRemoveModule}
                />
              ))}
              <Button onClick={handleAddModule} className="w-full" disabled={!isAuthorized || isCommitting}>
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
                disabled={!isAuthorized || isCommitting}
                className={cn("font-mono text-xs bg-muted/50", !isJsonValid && 'border-red-500')}
              />
              {!isJsonValid && <p className="text-red-500 text-sm">Invalid JSON format.</p>}
            </div>
          )}

          <div className="flex justify-end items-center pt-4 border-t border-muted">
            <Button 
              onClick={handleCommitChanges} 
              disabled={!canCommit}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCommitting ? "Committing..." : "Commit Changes to Coda"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          
          {currentSchema.audit.last_edit.hash && (
            <div className="pt-4 border-t border-muted mt-4 text-sm">
              <h4 className="font-semibold text-primary">Last Verified Update:</h4>
              <p className="text-muted-foreground">Hash: {currentSchema.audit.last_edit.hash.substring(0, 10)}...</p>
              <p className="text-muted-foreground">TXID: {currentSchema.audit.last_edit.txid}</p>
              <p className="text-muted-foreground">Timestamp: {new Date(currentSchema.audit.last_edit.timestamp || '').toLocaleString()}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}