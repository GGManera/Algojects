"use client";

import React, { useState, useMemo } from 'react';
import { ProposedNoteEdit, Project } from '@/types/social';
import { ProjectMetadata } from '@/types/project';
import { UserDisplay } from './UserDisplay';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Hash, CheckCircle, XCircle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { cn, formatTimestamp } from '@/lib/utils';
import { CollapsibleContent } from './CollapsibleContent';
import { useWallet } from '@txnlab/use-wallet-react';
import { SuggestedMetadataItem } from './SuggestedMetadataItem';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';

interface ProjectMetadataSuggestionsListProps {
  project: Project;
  currentProjectMetadata: ProjectMetadata;
  onReviewSuggestion: (suggestion: ProposedNoteEdit) => void;
  isWhitelistedEditor: boolean;
  onInteractionSuccess: () => void;
}

export function ProjectMetadataSuggestionsList({
  project,
  currentProjectMetadata,
  onReviewSuggestion,
  isWhitelistedEditor,
  onInteractionSuccess,
}: ProjectMetadataSuggestionsListProps) {
  const { activeAddress } = useWallet();
  const { isMobile } = useAppContextDisplayMode();
  const allSuggestions = useMemo(() => Object.values(project.proposedNoteEdits || {}), [project.proposedNoteEdits]);
  
  // Filter suggestions based on status (currently only 'pending' is possible via on-chain note)
  const pendingSuggestions = allSuggestions.filter(s => s.status === 'pending');
  
  // Filter suggestions made by the current user
  const userSuggestions = useMemo(() => {
    if (!activeAddress) return [];
    return allSuggestions.filter(s => s.sender === activeAddress);
  }, [allSuggestions, activeAddress]);

  const [isPendingListOpen, setIsPendingListOpen] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);

  if (!activeAddress && allSuggestions.length === 0) {
    return (
      <Alert className="bg-muted/50 border-muted text-muted-foreground">
        <Hash className="h-4 w-4" />
        <AlertTitle>No Suggestions Yet</AlertTitle>
        <AlertDescription>Be the first to suggest a metadata change for this project.</AlertDescription>
      </Alert>
    );
  }
  
  if (allSuggestions.length === 0) return null;

  // Helper to clean and parse the JSON delta for display
  const parseDelta = (content: string): ProjectMetadata | null => {
    try {
      let cleanedContent = content.trim().replace(/[\r\n\t]/g, '');
      const parsed = JSON.parse(cleanedContent); 
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as ProjectMetadata;
      }
    } catch (e) {
      // console.error("Failed to parse suggestion JSON:", e, "Raw content:", content);
    }
    return null;
  };
  
  // The click handler for the entire suggestion item (only relevant for editors)
  const handleSuggestionItemClick = (suggestion: ProposedNoteEdit) => {
    if (isWhitelistedEditor) {
        onReviewSuggestion(suggestion);
    }
  };

  const renderSuggestionItem = (suggestion: ProposedNoteEdit, isEditorView: boolean) => {
    const delta = parseDelta(suggestion.content);
    const isUserOwn = activeAddress === suggestion.sender;
    
    if (!delta) {
        return (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-md bg-card border border-destructive/50">
                <div className="flex flex-col space-y-1 flex-1 min-w-0">
                    <span className="text-sm font-semibold text-destructive">Invalid JSON content (Review required)</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UserDisplay address={suggestion.sender} textSizeClass="text-xs" avatarSizeClass="h-4 w-4" linkTo={`/profile/${suggestion.sender}`} />
                        <span>{formatTimestamp(suggestion.timestamp)}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div 
            key={suggestion.id} 
            className={cn(
                "flex flex-col space-y-3 p-3 rounded-md bg-card border border-primary/30",
                isEditorView ? "cursor-pointer hover:bg-muted/50 transition-colors" : "cursor-default"
            )}
            onClick={() => handleSuggestionItemClick(suggestion)} // Click on item opens modal for editors
        >
            
            {/* Metadata Preview (Simulated Button/Card) */}
            <div className="grid grid-cols-2 gap-2">
                {delta.map((item, index) => (
                    <SuggestedMetadataItem 
                        key={index} 
                        item={item} 
                        isMobile={isMobile} 
                        className="!max-w-none" // Override max-width for grid layout
                    />
                ))}
            </div>

            {/* Details and Action */}
            <div className="flex items-center justify-between pt-2 border-t border-muted">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserDisplay address={suggestion.sender} textSizeClass="text-xs" avatarSizeClass="h-4 w-4" linkTo={`/profile/${suggestion.sender}`} />
                    <span>{formatTimestamp(suggestion.timestamp)}</span>
                    {!isEditorView && !isUserOwn && <span className="text-yellow-500">Pending Review</span>}
                </div>
                
                {isEditorView && (
                    <Button 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); onReviewSuggestion(suggestion); }} // Button explicitly opens modal
                        className="bg-green-600 hover:bg-green-700"
                    >
                        Review & Accept
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Pending Suggestions (Visible ONLY to Whitelisted Editors, with Review button) */}
      {isWhitelistedEditor && pendingSuggestions.length > 0 && (
        <div className="space-y-2 border rounded-lg p-4 bg-yellow-900/20 border-yellow-500/50">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsPendingListOpen(prev => !prev)}
          >
            <h3 className="text-lg font-semibold flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="h-5 w-5" /> {pendingSuggestions.length} Pending Suggestion(s) (Editor View)
            </h3>
            {isPendingListOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
          <CollapsibleContent isOpen={isPendingListOpen}>
            <div className="space-y-4 pt-2">
              {pendingSuggestions.map(suggestion => renderSuggestionItem(suggestion, true))}
            </div>
          </CollapsibleContent>
        </div>
      )}

      {/* 2. User's Own Suggestions (Visible ONLY to the user who made them) */}
      {userSuggestions.length > 0 && (
        <div className="space-y-2 border rounded-lg p-4 bg-primary/10 border-primary/50">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsUserListOpen(prev => !prev)}
          >
            <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
              <Hash className="h-5 w-5" /> Your Suggestions ({userSuggestions.length})
            </h3>
            {isUserListOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
          <CollapsibleContent isOpen={isUserListOpen}>
            <div className="space-y-4 pt-2">
              {userSuggestions.map(suggestion => renderSuggestionItem(suggestion, false))}
            </div>
          </CollapsibleContent>
        </div>
      )}
      
      {/* 3. General Pending Suggestions (Visible to ALL connected non-editors) */}
      {activeAddress && !isWhitelistedEditor && pendingSuggestions.length > 0 && (
        <div className="space-y-2 border rounded-lg p-4 bg-muted/30 border-muted-foreground/50">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsPendingListOpen(prev => !prev)}
          >
            <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
              <Hash className="h-5 w-5" /> Pending Suggestions ({pendingSuggestions.length}) (Public View)
            </h3>
            {isPendingListOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
          <CollapsibleContent isOpen={isPendingListOpen}>
            <div className="space-y-4 pt-2">
              {pendingSuggestions.map(suggestion => renderSuggestionItem(suggestion, false))}
            </div>
          </CollapsibleContent>
        </div>
      )}
    </div>
  );
}