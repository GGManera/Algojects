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
import { CommitConfirmationDialog } from './CommitConfirmationDialog';

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

/**
 * Ensures the schema object has all necessary nested properties initialized as objects or arrays.
 */
const normalizeSchema = (schema: FormStructure): FormStructure => {
    const normalized = { ...schema };
    
    // Ensure top-level objects exist
    normalized.metadata = normalized.metadata || {};
    normalized.governance = normalized.governance || {};
    normalized.audit = normalized.audit || { last_edit: {} };
    normalized.audit.last_edit = normalized.audit.last_edit || {};
    normalized.rendering_rules = normalized.rendering_rules || {};
    
    // Ensure modules is an array
    normalized.modules = Array.isArray(normalized.modules) ? normalized.modules : [];
    
    // Ensure governance nested objects exist
    normalized.governance.reward_eligibility = normalized.governance.reward_eligibility || {};
    
    // Ensure fixed wallets are set from environment if missing in schema
    normalized.authorized_wallet = normalized.authorized_wallet || import.meta.env.VITE_FEEDBACK_ADMIN_WALLET || "ADMIN_WALLET_NOT_SET";
    normalized.project_wallet = normalized.project_wallet || import.meta.env.VITE_FEEDBACK_PROJECT_WALLET || "PROJECT_WALLET_NOT_SET";

    return normalized;
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
  const [structuredDraft, setStructuredDraft] = useState<FormStructure>(() => normalizeSchema(deepCloneSchema(currentSchema)));
  
  // State for JSON editing (synced with structuredDraft)
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(currentSchema, null, 2));
  
  const [isJsonValid, setIsJsonValid] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [finalDraftToConfirm, setFinalDraftToConfirm] = useState<FormStructure | null>(null);

  const adminWallet = import.meta.env.VITE_FEEDBACK_ADMIN_WALLET;
  const projectWallet = import.meta.env.VITE_FEEDBACK_PROJECT_WALLET;

  const isAuthorized = useMemo(() => {
    return activeAddress === adminWallet;
  }, [activeAddress, adminWallet]);

  // --- Sync Effects ---

  // 1. Sync currentSchema -> structuredDraft on initial load/commit
  useEffect(() => {
    const clonedSchema = deepCloneSchema(currentSchema);
    
    // Check if the fetched schema is clearly incomplete (e.g., missing modules array)
    const isSchemaIncomplete = !clonedSchema.modules || clonedSchema.modules.length === 0;
    
    if (isSchemaIncomplete && currentSchema.rowId) {
        // Se incompleto mas temos rowId, inicializa com o template de fallback
        const safeDraft = normalizeSchema({ ...FALLBACK_FORM_STRUCTURE_TEMPLATE, rowId: currentSchema.rowId } as FormStructure);
        setStructuredDraft(safeDraft);
        setJsonDraft(JSON.stringify(safeDraft, null, 2));
    } else if (currentSchema.rowId) {
        // Se completo e tem rowId, usa o esquema clonado e normalizado
        const normalizedDraft = normalizeSchema(clonedSchema);
        setStructuredDraft(normalizedDraft);
        setJsonDraft(JSON.stringify(currentSchema, null, 2));
    }
  }, [currentSchema, deepCloneSchema]);

  // 2. Sync structuredDraft -> jsonDraft whenever structuredDraft changes
  useEffect(() => {
    try {
      // Use o structuredDraft completo (sem rowId) para serialização
      const { rowId, ...draftWithoutRowId } = structuredDraft;
      // Normalize again just before stringify to ensure no empty objects sneak in from editing
      const normalizedDraft = normalizeSchema(draftWithoutRowId as FormStructure);
      
      setJsonDraft(JSON.stringify(normalizedDraft, null, 2));
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
      
      // Merge parsed JSON with existing structuredDraft to ensure all properties are kept
      const mergedDraft: FormStructure = {
          ...structuredDraft, // Start with the current full draft
          ...parsed,          // Overwrite with parsed top-level fields
          // Ensure nested objects are also merged if they exist in both
          metadata: { ...structuredDraft.metadata, ...parsed.metadata },
          governance: { ...structuredDraft.governance, ...parsed.governance },
          audit: { ...structuredDraft.audit, ...parsed.audit },
          modules: parsed.modules || structuredDraft.modules, // Modules must be replaced entirely if present
      };

      setStructuredDraft(normalizeSchema(mergedDraft)); // Normalize the merged result
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
      modules: [...(prev.modules || []), newModule]
    }));
  }, []);

  // NEW: Functions to reorder modules
  const handleMoveModuleUp = useCallback((index: number) => {
    if (index === 0) return;
    setStructuredDraft(prev => {
      const newModules = [...(prev.modules || [])];
      const [movedModule] = newModules.splice(index, 1);
      newModules.splice(index - 1, 0, movedModule);
      return { ...prev, modules: newModules };
    });
  }, []);

  const handleMoveModuleDown = useCallback((index: number) => {
    if (index === (structuredDraft.modules || []).length - 1) return;
    setStructuredDraft(prev => {
      const newModules = [...(prev.modules || [])];
      const [movedModule] = newModules.splice(index, 1);
      newModules.splice(index + 1, 0, movedModule);
      return { ...prev, modules: newModules };
    });
  }, [structuredDraft.modules]);
  
  const handleUpdateMetadata = useCallback((key: keyof FormStructure['metadata'], value: string) => {
    setStructuredDraft(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [key]: value }
    }));
  }, []);

  // --- Core Logic: Prepare Draft for Confirmation ---

  const prepareDraftForCommit = useCallback(() => {
    const draftToCommit = structuredDraft;

    if (!draftToCommit || !isJsonValid) {
      showError("Invalid draft or missing Coda Row ID.");
      return null;
    }
    
    // 1. Normalize the draft one last time to ensure integrity
    const normalizedDraft = normalizeSchema(draftToCommit);

    // 2. Generate local hash
    const localHash = generateLocalHash(normalizedDraft);
    
    // 3. Increment version number (e.g., "1.3" -> "1.4")
    const currentVersion = parseFloat(currentSchema.version || '1.0'); // Use currentSchema version as base
    const newVersion = (Math.floor(currentVersion * 10) + 1) / 10;

    // 4. Construir o finalDraft
    const finalDraft: FormStructure = {
      ...normalizedDraft,
      version: newVersion.toFixed(1), // Incremented version
      metadata: {
          ...normalizedDraft.metadata,
          updated_at: new Date().toISOString(),
      },
      audit: {
        last_edit: {
          hash: localHash,
          txid: 'LOCAL_COMMIT', // Mark as local commit
          editor_wallet: activeAddress || 'unconnected',
          timestamp: new Date().toISOString(),
        }
      },
    };
    
    // NEW: Log the final draft before confirmation
    console.log("[AdminFormEditor] Final Draft Prepared for Commit:", JSON.stringify(finalDraft, null, 2));

    return finalDraft;
  }, [structuredDraft, isJsonValid, activeAddress, currentSchema.version]);

  const handlePrepareCommit = () => {
    const finalDraft = prepareDraftForCommit();
    if (finalDraft) {
      setFinalDraftToConfirm(finalDraft);
      setIsConfirmationOpen(true);
    }
  };

  // --- Core Logic: Execute Commit ---

  const handleExecuteCommit = async () => {
    if (!finalDraftToConfirm) return;

    setIsCommitting(true);
    const toastId = showLoading(`Committing version ${finalDraftToConfirm.version}...`);

    try {
      // 1. Commit the final draft using the client API (which now POSTs a new row)
      await createFormStructureClient(finalDraftToConfirm);
      
      dismissToast(toastId);
      showSuccess(`Form schema updated to version ${finalDraftToConfirm.version} successfully!`);
      setIsConfirmationOpen(false);
      onSchemaUpdate(); // Trigger parent refetch
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "Failed to commit changes to Coda.");
    } finally {
      setIsCommitting(false);
    }
  };

  const canSubmit = isAuthorized && isJsonValid && !isCommitting;

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
                  onMoveUp={handleMoveModuleUp} // NEW
                  onMoveDown={handleMoveModuleDown} // NEW
                  isFirst={index === 0} // NEW
                  isLast={index === (structuredDraft.modules || []).length - 1} // NEW
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
              onClick={handlePrepareCommit} 
              disabled={!canSubmit}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCommitting ? "Preparing..." : "Review & Commit New Version"}
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
      
      <CommitConfirmationDialog
        isOpen={isConfirmationOpen}
        onOpenChange={setIsConfirmationOpen}
        finalDraft={finalDraftToConfirm}
        onConfirm={handleExecuteCommit}
        isCommitting={isCommitting}
      />
    </>
  );
}