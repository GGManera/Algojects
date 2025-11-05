"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FormStructure, createFormStructureClient, generateLocalHash } from '@/lib/feedback-api';
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

// Define a fallback structure locally for safety if the fetched schema is empty/corrupted
const FALLBACK_FORM_STRUCTURE_TEMPLATE: Omit<FormStructure, 'rowId'> & { rowId?: string } = {
  form_id: "algojects_feedback_master",
  version: "1.3",
  feedback_version: "v1",
  authorized_wallet: import.meta.env.VITE_FEEDBACK_ADMIN_WALLET || "ADMIN_WALLET_NOT_SET",
  project_wallet: import.meta.env.VITE_FEEDBACK_PROJECT_WALLET || "PROJECT_WALLET_NOT_SET",
  hash_verification_required: true,
  metadata: {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: "AlgoJects dynamic feedback schema. Master JSON for FormStructure stored in Coda."
  },
  governance: {
    enabled: true,
    threshold_min_responses: 100,
    reward_eligibility: {
      min_posts: 2,
      min_balance_algo: 1,
      reward_amount_algo: 1
    },
    versioning_policy: "questions_reach_threshold_then_archive_in_next_version"
  },
  modules: [
    { id: "general", title: "General Feedback", description: "Universal module.", questions: [] },
    { id: "contributor", title: "Contributor / Creator Feedback", description: "Project creation/editing.", questions: [] },
    { id: "writer", title: "Writer Feedback", description: "Posting experience.", questions: [] },
    { id: "curator", title: "Curator Feedback", description: "Curation and CIX.", questions: [] },
  ],
  rendering_rules: {},
  audit: {
    last_edit: {
      hash: null,
      txid: null,
      editor_wallet: null,
      timestamp: null,
    }
  },
};


export function AdminFormEditor({ currentSchema, onSchemaUpdate }: AdminFormEditorProps) {
  const { activeAddress } = useWallet();
  const [editingMode, setEditingMode] = useState<'structured' | 'json'>('structured');
  
  // Função para criar um clone profundo do esquema
  const deepCloneSchema = useCallback((schema: FormStructure): FormStructure => {
    // Remove rowId antes de clonar, pois ele não faz parte do esquema JSON
    const { rowId, ...schemaWithoutRowId } = schema;
    return JSON.parse(JSON.stringify(schemaWithoutRowId)) as FormStructure;
  }, []);

  // 1. Inicialização do estado com clone profundo
  const [structuredDraft, setStructuredDraft] = useState<FormStructure>(() => deepCloneSchema(currentSchema));
  
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
    // Se o esquema atual for atualizado (após um commit bem-sucedido), re-inicialize o rascunho
    const clonedSchema = deepCloneSchema(currentSchema);
    
    // Check if the fetched schema is clearly incomplete (e.g., missing modules array)
    const isSchemaIncomplete = !clonedSchema.modules || clonedSchema.modules.length === 0;
    
    if (isSchemaIncomplete && currentSchema.rowId) {
        // Se incompleto mas temos rowId, inicializa com o template de fallback
        const safeDraft = { ...FALLBACK_FORM_STRUCTURE_TEMPLATE, rowId: currentSchema.rowId } as FormStructure;
        setStructuredDraft(safeDraft);
        setJsonDraft(JSON.stringify(safeDraft, null, 2));
    } else if (currentSchema.rowId) {
        // Se completo e tem rowId, usa o esquema clonado
        setStructuredDraft(clonedSchema);
        setJsonDraft(JSON.stringify(currentSchema, null, 2));
    }
  }, [currentSchema, deepCloneSchema]);

  // 2. Sync structuredDraft -> jsonDraft whenever structuredDraft changes
  useEffect(() => {
    try {
      // Use o structuredDraft completo (sem rowId) para serialização
      const { rowId, ...draftWithoutRowId } = structuredDraft;
      setJsonDraft(JSON.stringify(draftWithoutRowId, null, 2));
      setIsJsonValid(true);
    } catch (e) {
      console.error("Error syncing structuredDraft to jsonDraft:", e);
    }
  }, [structuredDraft]);

  // 3. Sync jsonDraft -> structuredDraft when switching from JSON mode
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newJson = e.target.value;
    setJsonDraft(newJson);
    try {
      const parsed = JSON.parse(newJson);
      
      // Se o JSON for válido, substitua o structuredDraft pelo objeto completo
      // Isso garante que todas as edições feitas no JSON sejam refletidas no structuredDraft
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
      modules: (prev.modules || []).map((m, i) => i === index ? updatedModule : m)
    }));
  }, []);

  const handleRemoveModule = useCallback((index: number) => {
    setStructuredDraft(prev => ({
      ...prev,
      modules: (prev.modules || []).filter((_, i) => i !== index)
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
      modules: [...(prev.modules || []), newModule] // Ensure prev.modules is an array
    }));
  }, []);
  
  const handleUpdateMetadata = useCallback((key: keyof FormStructure['metadata'], value: string) => {
    setStructuredDraft(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [key]: value }
    }));
  }, []);

  // --- Core Logic: Direct Commit (Now creates a new version) ---

  const handleCommitChanges = async () => {
    const draftToCommit = structuredDraft;

    if (!draftToCommit || !isJsonValid) {
      showError("Invalid draft or missing Coda Row ID.");
      return;
    }
    
    setIsCommitting(true);
    const toastId = showLoading("Committing changes directly to Coda...");

    try {
      // 1. Generate local hash
      const localHash = generateLocalHash(draftToCommit);
      
      // 2. Increment version number (e.g., "1.3" -> "1.4")
      const currentVersion = parseFloat(draftToCommit.version || '1.0');
      // Increment by 0.1 and fix to one decimal place
      const newVersion = (Math.floor(currentVersion * 10) + 1) / 10;

      // 3. Construir o finalDraft usando o structuredDraft completo
      const finalDraft: FormStructure = {
        ...draftToCommit,
        version: newVersion.toFixed(1), // Ensure it's formatted back to string "X.Y"
        metadata: {
            ...draftToCommit.metadata,
            updated_at: new Date().toISOString(),
        },
        // Garantir que as propriedades aninhadas sejam copiadas explicitamente
        governance: draftToCommit.governance,
        modules: draftToCommit.modules,
        rendering_rules: draftToCommit.rendering_rules,
        audit: {
          last_edit: {
            hash: localHash,
            txid: 'LOCAL_COMMIT', // Mark as local commit
            editor_wallet: activeAddress || 'unconnected',
            timestamp: new Date().toISOString(),
          }
        },
        // Garantir que os campos fixos estejam presentes
        authorized_wallet: draftToCommit.authorized_wallet || adminWallet,
        project_wallet: draftToCommit.project_wallet || projectWallet,
      };
      
      // 4. Commit the final draft using the client API (which now POSTs a new row)
      await createFormStructureClient(finalDraft);
      
      dismissToast(toastId);
      showSuccess(`Form schema updated to version ${finalDraft.version} successfully!`);
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
                    <Input id="form-id" value={structuredDraft.form_id || ''} disabled className="bg-card" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="feedback-version">Feedback Version</Label>
                    <Input id="feedback-version" value={structuredDraft.feedback_version || ''} disabled className="bg-card" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea 
                        id="description" 
                        value={structuredDraft.metadata?.description || ''} 
                        onChange={(e) => handleUpdateMetadata('description', e.target.value)}
                        disabled={!isAuthorized || isCommitting}
                        className="bg-card"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="admin-wallet">Admin Wallet</Label>
                    <Input id="admin-wallet" value={structuredDraft.authorized_wallet || ''} disabled className="bg-card font-mono text-xs" />
                    <Label htmlFor="project-wallet">Project Wallet</Label>
                    <Input id="project-wallet" value={structuredDraft.project_wallet || ''} disabled className="bg-card font-mono text-xs" />
                </div>
            </div>
          </div>

          {editingMode === 'structured' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary">Modules</h3>
              {(structuredDraft.modules || []).map((module, index) => (
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
              {isCommitting ? "Committing..." : "Commit New Version"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          
          {currentSchema.audit?.last_edit?.hash && (
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