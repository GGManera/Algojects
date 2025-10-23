"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { useWallet } from "@txnlab/use-wallet-react";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useNfdResolver } from "@/hooks/useNfdResolver";
import { StyledTextarea } from "@/components/ui/StyledTextarea";
import { InteractionCardInput } from "./InteractionCardInput";
import { ProjectMetadata, MetadataItem } from '@/types/project';
import { PlusCircle, Trash2, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserDisplay } from "./UserDisplay";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { fetchAccountAssetHoldings } from '@/utils/algorand'; // NEW: Import fetchAccountAssetHoldings
import { retryFetch } from "@/utils/api"; // Import retryFetch

const DESCRIPTION_MAX_LENGTH = 2048;
const INDEXER_URL = "https://mainnet-idx.algonode.cloud"; // Define INDEXER_URL

interface ProjectDetailsFormProps {
  projectId: string;
  initialProjectMetadata: ProjectMetadata;
  projectCreatorAddress?: string;
  onProjectDetailsUpdated: () => void;
}

export function ProjectDetailsForm({
  projectId,
  initialProjectMetadata,
  projectCreatorAddress,
  onProjectDetailsUpdated
}: ProjectDetailsFormProps) {
  const [metadataItems, setMetadataItems] = useState<ProjectMetadata>(initialProjectMetadata);
  const [projectTags, setProjectTags] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { activeAddress } = useWallet();
  const { updateProjectDetails, loading: detailsLoadingState, isRefreshing: detailsRefreshingState } = useProjectDetails(); // NEW: Destructure updateProjectDetails
  const isProjectDetailsFetching = detailsLoadingState || detailsRefreshingState;

  // Helper to find a metadata item by type OR title (for non-standard fields like 'Creator Wallet')
  const findMetadataItem = useCallback((type: MetadataItem['type'] | string, title?: string) => {
    return metadataItems.find(item => item.type === type || (title && item.title === title));
  }, [metadataItems]);

  // Helper to update or add a metadata item
  const updateOrCreateMetadataItem = useCallback((type: MetadataItem['type'], title: string, value: string) => {
    setMetadataItems(prev => {
      const existingIndex = prev.findIndex(item => item.type === type && item.title === title);
      if (existingIndex !== -1) {
        return prev.map((item, i) => i === existingIndex ? { ...item, title, value } : item);
      } else {
        // If we are updating a fixed field, we might need to remove an old version if it existed under a different type/title combination.
        // For simplicity and robustness, we rely on the filter/reconstruction in handleSubmit to clean up.
        return [...prev, { title, value, type }];
      }
    });
  }, []);

  // NEW: Validation helper for Algorand address
  const isValidAlgorandAddress = (addr: string) => addr.length === 58;

  // Extract "fixed" fields from metadataItems for local state/display
  const projectNameContent = findMetadataItem('project-name')?.value || '';
  const projectDescriptionContent = findMetadataItem('project-description')?.value || '';
  const whitelistedAddressesContent = findMetadataItem('whitelisted-editors')?.value || '';
  const isCreatorAdded = findMetadataItem('is-creator-added')?.value === 'true';
  const addedByAddress = findMetadataItem('added-by-address')?.value;
  const isCommunityNotes = findMetadataItem('is-community-notes')?.value === 'true';
  const isClaimed = findMetadataItem('is-claimed')?.value === 'true';
  const creatorWalletContent = findMetadataItem('address', 'Creator Wallet')?.value || ''; // Look for type 'address' AND title 'Creator Wallet'
  const projectWalletContent = findMetadataItem('project-wallet')?.value || ''; // NEW: Project Wallet
  const assetIdContent = findMetadataItem('asset-id')?.value || ''; // NEW: Asset ID
  const assetUnitNameContent = findMetadataItem('asset-unit-name')?.value || ''; // NEW: Asset Unit Name

  // Filter out the "fixed" metadata items from the dynamic list for rendering
  const fixedTypesAndTitles = useMemo(() => new Set([
    'project-name', 'project-description', 'whitelisted-editors', 'is-creator-added', 'added-by-address', 'is-community-notes', 'tags', 'is-claimed', 'Creator Wallet', 'project-wallet', 'asset-id', 'asset-unit-name'
  ]), []);

  const dynamicMetadataItems = useMemo(() => {
    return metadataItems.filter(item => {
      // Check if it's a fixed type
      if (fixedTypesAndTitles.has(item.type || '')) return false;
      // Check if it's the fixed 'Creator Wallet' item (which uses type 'address' and title 'Creator Wallet')
      if (item.type === 'address' && item.title === 'Creator Wallet') return false;
      // Check if it's the fixed 'Tags' item (which uses type 'text' and title 'Tags')
      if (item.type === 'text' && item.title === 'Tags') return false;
      
      return true;
    });
  }, [metadataItems, fixedTypesAndTitles]);

  const handleAddDynamicMetadataItem = useCallback(() => {
    setMetadataItems(prev => [...prev, { title: '', value: '', type: 'text' }]);
  }, []);

  const handleUpdateDynamicMetadataItem = useCallback((index: number, field: keyof MetadataItem, value: string) => {
    setMetadataItems(prev => {
      const itemToUpdate = dynamicMetadataItems[index];
      if (!itemToUpdate) return prev;

      return prev.map(item => item === itemToUpdate ? { ...item, [field]: value } : item);
    });
  }, [dynamicMetadataItems]);

  const handleUpdateDynamicMetadataType = useCallback((index: number, type: MetadataItem['type']) => {
    setMetadataItems(prev => {
      const itemToUpdate = dynamicMetadataItems[index];
      if (!itemToUpdate) return prev;

      return prev.map(item => item === itemToUpdate ? { ...item, type } : item);
    });
  }, [dynamicMetadataItems]);

  const handleRemoveDynamicMetadataItem = useCallback((index: number) => {
    setMetadataItems(prev => {
      const itemToRemove = dynamicMetadataItems[index];
      return prev.filter(item => item !== itemToRemove);
    });
  }, [dynamicMetadataItems]);

  // Determine the effective list of inputs for NFD resolution for authorization
  // We still need NFD resolution for whitelisted editors
  const effectiveAuthInputs = useMemo(() => {
    const authAddresses: string[] = [];
    
    // Only include wallet contents if they look like an address
    if (isValidAlgorandAddress(creatorWalletContent)) {
      authAddresses.push(creatorWalletContent);
    }
    if (isValidAlgorandAddress(projectWalletContent)) {
      authAddresses.push(projectWalletContent);
    }
    
    if (projectCreatorAddress) {
      authAddresses.push(projectCreatorAddress);
    }
    
    if (addedByAddress) {
      authAddresses.push(addedByAddress);
    }
    
    whitelistedAddressesContent.split(',').map(addr => addr.trim()).filter(Boolean).forEach(addr => authAddresses.push(addr));
    
    return Array.from(new Set(authAddresses));
  }, [projectCreatorAddress, addedByAddress, whitelistedAddressesContent, creatorWalletContent, projectWalletContent]);

  const { resolvedAddresses: authorizedAddresses, loading: resolvingAuthNfds } = useNfdResolver(effectiveAuthInputs);

  useEffect(() => {
    // When initialProjectMetadata changes, update the internal state
    setMetadataItems(initialProjectMetadata.map(item => ({ ...item, type: item.type || 'text' })));

    // Initialize projectTags from initialProjectMetadata
    const initialTagsItem = initialProjectMetadata.find(item => item.type === 'tags');
    if (initialTagsItem?.value) {
      setProjectTags(initialTagsItem.value);
    } else {
      setProjectTags("");
    }
  }, [initialProjectMetadata]);

  // Determine if the current user is authorized to edit
  const isAuthorized = () => {
    if (!activeAddress) return false;
    if (resolvingAuthNfds) return false;
    return authorizedAddresses.has(activeAddress);
  };

  const handleSubmit = async () => {
    if (!activeAddress) {
      showError("Please connect your wallet to update project details.");
      return;
    }
    if (!isAuthorized()) {
      showError("You are not authorized to edit these project details.");
      return;
    }
    if (!projectNameContent.trim()) {
      showError("Project name cannot be empty.");
      return;
    }
    // Validation for Creator Wallet: must be empty or a valid 58-char address
    if (creatorWalletContent.trim() && !isValidAlgorandAddress(creatorWalletContent)) {
      showError("Creator Wallet must be a valid 58-character Algorand address.");
      return;
    }
    // NEW: Validation for Project Wallet: must be empty or a valid 58-char address
    if (projectWalletContent.trim() && !isValidAlgorandAddress(projectWalletContent)) {
      showError("Project Wallet must be a valid 58-character Algorand address.");
      return;
    }
    // NEW: Validation for Asset ID: must be empty or a valid positive integer
    if (assetIdContent.trim()) {
      const assetIdNum = parseInt(assetIdContent, 10);
      if (isNaN(assetIdNum) || assetIdNum <= 0) {
        showError("Asset ID must be a positive integer.");
        return;
      }
    }

    setIsLoading(true);
    const toastId = showLoading("Updating project details...");

    try {
      // 1. Collect all dynamic metadata items that have content
      const dynamicItemsToSend: ProjectMetadata = dynamicMetadataItems
        .filter(item => item.title.trim() && item.value.trim())
        .map(item => ({ ...item, type: item.type || 'text' }));

      // 2. Define all fixed metadata items based on current local state
      const finalCreatorWalletValue = creatorWalletContent.trim();
      const finalProjectWalletValue = projectWalletContent.trim(); // NEW: Project Wallet value
      const finalAssetIdValue = assetIdContent.trim(); // NEW: Asset ID value
      let finalAssetUnitNameValue = assetUnitNameContent.trim(); // NEW: Asset Unit Name value

      // NEW: If Asset ID is provided, try to fetch its unit-name if not already set or if assetId changed
      if (finalAssetIdValue) {
        const assetIdNum = parseInt(finalAssetIdValue, 10);
        const currentAssetIdInMetadata = initialProjectMetadata.find(item => item.type === 'asset-id')?.value;
        const currentAssetUnitNameInMetadata = initialProjectMetadata.find(item => item.type === 'asset-unit-name')?.value;

        if (assetIdNum > 0 && (finalAssetIdValue !== currentAssetIdInMetadata || !finalAssetUnitNameValue || finalAssetUnitNameValue !== currentAssetUnitNameInMetadata)) {
          try {
            const response = await retryFetch(`${INDEXER_URL}/v2/assets/${assetIdNum}`, undefined, 5); // Increased retries
            if (response.ok) {
              const data = await response.json();
              const unitName = data.asset.params['unit-name'];
              if (unitName) {
                finalAssetUnitNameValue = unitName;
              } else {
                finalAssetUnitNameValue = ''; // Clear if unit name is missing
              }
            } else {
              console.warn(`Failed to fetch unit-name for asset ID ${assetIdNum}. Status: ${response.status}`);
              finalAssetUnitNameValue = ''; // Clear if fetch fails
            }
          } catch (e) {
            console.error(`Error fetching unit-name for asset ID ${assetIdNum}:`, e);
            finalAssetUnitNameValue = ''; // Clear on error
          }
        }
      } else {
        finalAssetUnitNameValue = ''; // Clear unit name if asset ID is removed
      }
      
      const fixedItems: ProjectMetadata = [
        { title: 'Project Name', value: projectNameContent, type: 'project-name' },
        { title: 'Description', value: projectDescriptionContent, type: 'project-description' },
        { title: 'Tags', value: projectTags, type: 'tags' },
        { title: 'Whitelisted Editors', value: whitelistedAddressesContent, type: 'whitelisted-editors' },
        { title: 'Is Creator Added', value: isCreatorAdded ? 'true' : 'false', type: 'is-creator-added' },
        { title: 'Added By Address', value: addedByAddress || '', type: 'added-by-address' },
        { title: 'Is Community Notes', value: isCommunityNotes ? 'true' : 'false', type: 'is-community-notes' },
        { title: 'Is Claimed', value: isClaimed ? 'true' : 'false', type: 'is-claimed' },
        // Creator Wallet: Use the raw content, validated as an address above
        ...(finalCreatorWalletValue ? [{ title: 'Creator Wallet', value: finalCreatorWalletValue, type: 'address' as const }] : []),
        // NEW: Project Wallet
        ...(finalProjectWalletValue ? [{ title: 'Project Wallet', value: finalProjectWalletValue, type: 'project-wallet' as const }] : []),
        // NEW: Asset ID and Asset Unit Name
        ...(finalAssetIdValue ? [{ title: 'Asset ID', value: finalAssetIdValue, type: 'asset-id' as const }] : []),
        ...(finalAssetUnitNameValue ? [{ title: 'Asset Unit Name', value: finalAssetUnitNameValue, type: 'asset-unit-name' as const }] : []),
      ].filter(item => item.value.trim() || ['is-creator-added', 'is-community-notes', 'is-claimed'].includes(item.type || ''));

      // 3. Combine all items, filtering out any fixed items that are empty (except boolean flags)
      const finalMetadata: ProjectMetadata = [...fixedItems, ...dynamicItemsToSend];

      await updateProjectDetails({
        projectId,
        newProjectMetadata: finalMetadata
      });
      dismissToast(toastId);
      showSuccess("Project details updated successfully!");
      onProjectDetailsUpdated();
    } catch (error) {
      dismissToast(toastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const isProjectWalletValid = !projectWalletContent.trim() || isValidAlgorandAddress(projectWalletContent); // NEW validation
  const isCreatorWalletValid = !creatorWalletContent.trim() || isValidAlgorandAddress(creatorWalletContent); // Existing validation
  const isAssetIdValid = !assetIdContent.trim() || (parseInt(assetIdContent, 10) > 0); // NEW validation

  const canSubmit = !activeAddress || isLoading || !isAuthorized() || resolvingAuthNfds || isProjectDetailsFetching || !isCreatorWalletValid || !isProjectWalletValid || !isAssetIdValid;
  const inputDisabled = !activeAddress || isLoading || resolvingAuthNfds || isProjectDetailsFetching;

  if (!activeAddress) {
    return (
      <Card className="w-full mt-6">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Unauthorized</AlertTitle>
            <AlertDescription>Please connect your wallet to view or edit project details.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (resolvingAuthNfds || isProjectDetailsFetching) {
    return (
      <Card className="w-full mt-6">
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">Resolving authorization details...</p>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthorized()) {
    return (
      <Card className="w-full mt-6">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Unauthorized</AlertTitle>
            <AlertDescription>You are not authorized to edit these project details.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  let notesLabel = "Notes";
  if (isCommunityNotes) {
    notesLabel = "Community Notes";
  } else if (isCreatorAdded) {
    notesLabel = "Creator Notes";
  } else if (addedByAddress) {
    notesLabel = "Contributor Notes";
  }

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle>Update Project Details</CardTitle>
        <CardDescription>
          Edit the name, description, and whitelisted editors for Project {projectId}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="projectName" className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Project Name</Label>
          <Input
            id="projectName"
            placeholder="Enter project name here..."
            value={projectNameContent}
            onChange={(e) => updateOrCreateMetadataItem('project-name', 'Project Name', e.target.value)}
            disabled={inputDisabled}
            className="bg-muted/50"
          />
        </div>
        <div>
          <Label htmlFor="projectTags" className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Tags (comma-separated)</Label>
          <Input
            id="projectTags"
            placeholder="e.g., DeFi, NFT, Gaming"
            value={projectTags}
            onChange={(e) => setProjectTags(e.target.value)} // Tags are handled via local state and then merged in handleSubmit
            disabled={inputDisabled}
            className="bg-muted/50"
          />
        </div>
        <div>
          <Label htmlFor="projectDescription" className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">{notesLabel}</Label>
          <InteractionCardInput
            type="project-description"
            id="projectDescription"
            placeholder="Enter project description here..."
            value={projectDescriptionContent}
            onChange={(e) => updateOrCreateMetadataItem('project-description', 'Description', e.target.value)}
            disabled={inputDisabled}
            maxLength={DESCRIPTION_MAX_LENGTH}
            onSubmit={() => {}}
            isSubmitDisabled={true}
          />
        </div>

        {/* Fixed Fields: Added By Address */}
        {addedByAddress && (
          <div className="flex flex-col p-2 rounded-md bg-muted/50 border border-border">
            <span className="font-semibold text-muted-foreground text-xs">Added By Address:</span>
            <UserDisplay address={addedByAddress} textSizeClass="text-sm" avatarSizeClass="h-5 w-5" linkTo={`/profile/${addedByAddress}`} />
          </div>
        )}
        
        {/* Fixed Fields: Creator Wallet */}
        <div className="relative">
          <Label htmlFor="creatorWallet" className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Creator Wallet (Algorand Address)</Label>
          <Input
            id="creatorWallet"
            placeholder="Enter creator wallet address..."
            value={creatorWalletContent}
            onChange={(e) => updateOrCreateMetadataItem('address', 'Creator Wallet', e.target.value)}
            disabled={inputDisabled}
            className={cn("bg-muted/50 pr-4", {
              "border-red-500": creatorWalletContent.trim() && !isValidAlgorandAddress(creatorWalletContent),
              "border-green-500": creatorWalletContent.trim() && isValidAlgorandAddress(creatorWalletContent),
            })}
          />
          {creatorWalletContent.trim() && !isValidAlgorandAddress(creatorWalletContent) && (
            <p className="text-xs text-red-500 mt-1">Must be a valid 58-character Algorand address.</p>
          )}
        </div>

        {/* NEW Fixed Field: Project Wallet */}
        <div className="relative">
          <Label htmlFor="projectWallet" className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Project Wallet (Algorand Address)</Label>
          <Input
            id="projectWallet"
            placeholder="Enter project wallet address..."
            value={projectWalletContent}
            onChange={(e) => updateOrCreateMetadataItem('project-wallet', 'Project Wallet', e.target.value)}
            disabled={inputDisabled}
            className={cn("bg-muted/50 pr-4", {
              "border-red-500": projectWalletContent.trim() && !isValidAlgorandAddress(projectWalletContent),
              "border-green-500": projectWalletContent.trim() && isValidAlgorandAddress(projectWalletContent),
            })}
          />
          {projectWalletContent.trim() && !isValidAlgorandAddress(projectWalletContent) && (
            <p className="text-xs text-red-500 mt-1">Must be a valid 58-character Algorand address.</p>
          )}
        </div>
        {/* END NEW */}

        {/* NEW Fixed Field: Asset ID */}
        <div className="relative">
          <Label htmlFor="assetId" className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Associated Asset ID (Optional)</Label>
          <Input
            id="assetId"
            type="number"
            placeholder="e.g., 123456789"
            value={assetIdContent}
            onChange={(e) => updateOrCreateMetadataItem('asset-id', 'Asset ID', e.target.value)}
            disabled={inputDisabled}
            className={cn("bg-muted/50 pr-4", {
              "border-red-500": assetIdContent.trim() && (!isAssetIdValid || parseInt(assetIdContent, 10) <= 0),
              "border-green-500": assetIdContent.trim() && isAssetIdValid && parseInt(assetIdContent, 10) > 0,
            })}
          />
          {assetIdContent.trim() && (!isAssetIdValid || parseInt(assetIdContent, 10) <= 0) && (
            <p className="text-xs text-red-500 mt-1">Asset ID must be a positive integer.</p>
          )}
        </div>
        {/* END NEW */}

        {/* Dynamic Metadata Fields */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Additional Metadata</h3>
          {dynamicMetadataItems.map((item, index) => (
            <div key={index} className="flex flex-col sm:flex-row items-end gap-2">
              <div className="flex-1 space-y-1 w-full">
                <Label htmlFor={`metadata-title-${index}`} className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Title</Label>
                <Input
                  id={`metadata-title-${index}`}
                  placeholder="e.g., Website, X Profile, Asset ID"
                  value={item.title}
                  onChange={(e) => handleUpdateDynamicMetadataItem(index, 'title', e.target.value)}
                  disabled={inputDisabled}
                  className="bg-muted/50"
                />
              </div>
              <div className="flex-1 space-y-1 w-full">
                <Label htmlFor={`metadata-value-${index}`} className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Value</Label>
                <Input
                  id={`metadata-value-${index}`}
                  placeholder="e.g., https://example.com, @handle, 12345"
                  value={item.value}
                  onChange={(e) => handleUpdateDynamicMetadataItem(index, 'value', e.target.value)}
                  disabled={inputDisabled}
                  className="bg-muted/50"
                />
              </div>
              <div className="w-full sm:w-[150px] space-y-1">
                <Label htmlFor={`metadata-type-${index}`} className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Type</Label>
                <Select
                  value={item.type || 'text'}
                  onValueChange={(value: MetadataItem['type']) => handleUpdateDynamicMetadataType(index, value)}
                  disabled={inputDisabled}
                >
                  <SelectTrigger id={`metadata-type-${index}`} className="bg-muted/50">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="x-url">X (Twitter) URL</SelectItem>
                    <SelectItem value="asset-id">Asset ID</SelectItem>
                    <SelectItem value="address">Address</SelectItem>
                    <SelectItem value="asset-unit-name">Asset Unit Name</SelectItem> {/* NEW */}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveDynamicMetadataItem(index)}
                disabled={inputDisabled}
                className="text-destructive hover:text-destructive/90"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={handleAddDynamicMetadataItem}
            disabled={inputDisabled}
            className="w-full mt-2"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Add Metadata Field
          </Button>
        </div>
        <div>
          <Label htmlFor="whitelistedEditors" className="text-white text-xs absolute top-[-20px] left-0 bg-hodl-darker px-1">Whitelisted Editors (comma-separated addresses or NFDs)</Label>
          <StyledTextarea
            id="whitelistedEditors"
            placeholder="e.g., ADDRESS1, my.nfd, another.nfd"
            value={whitelistedAddressesContent}
            onChange={(e) => updateOrCreateMetadataItem('whitelisted-editors', 'Whitelisted Editors', e.target.value)}
            disabled={inputDisabled}
            onSubmit={() => {}}
            isSubmitDisabled={true}
          />
        </div>
        <Button onClick={handleSubmit} disabled={canSubmit} className="w-full">
          {isLoading ? "Updating..." : "Save Project Details"}
        </Button>
      </CardContent>
    </Card>
  );
}