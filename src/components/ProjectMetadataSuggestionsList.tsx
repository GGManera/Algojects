"use client";

import React, { useState, useMemo } from 'react';
import { ProposedNoteEdit, Project } from '@/types/social';
import { ProjectMetadata } from '@/types/project';
import { UserDisplay } from './UserDisplay';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Hash, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatTimestamp } from '@/lib/utils';
import { CollapsibleContent } from './CollapsibleContent';
import { useWallet } from '@txnlab/use-wallet-react';

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

  if (allSuggestions.length === 0) {
    return (
      <Alert className="bg-muted/50 border-muted text-muted-foreground">
        <Hash className="h-4 w-4" />
        <AlertTitle>No Suggestions Yet</AlertTitle>
        <AlertDescription>Be the first to suggest a metadata change for this project.</AlertDescription>
      </Alert>
    );
  }

  // Helper to parse the JSON delta for display
  const getDeltaPreview = (content: string) => {
    try {
      // IMPORTANT: Trim the content before parsing to remove potential leading/trailing whitespace from chunk assembly
      const parsed = JSON.parse(content.trim()); 
      if (Array.isArray(parsed) && parsed.length > 0) {
        const titles = parsed.map(item => item.title).join(', ');
        return `Changes proposed for: ${titles}`;
      }
    } catch (e) {
      return "Invalid JSON content (Review required)";
    }
    return "Empty or invalid suggestion content.";
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
            <div className="space-y-2 pt-2">
              {pendingSuggestions.map(suggestion => (
                <div key={suggestion.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-md bg-card border border-yellow-500/30">
                  <div className="flex flex-col space-y-1 flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">{getDeltaPreview(suggestion.content)}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UserDisplay address={suggestion.sender} textSizeClass="text-xs" avatarSizeClass="h-4 w-4" linkTo={`/profile/${suggestion.sender}`} />
                        <span>{formatTimestamp(suggestion.timestamp)}</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => onReviewSuggestion(suggestion)} className="mt-2 sm:mt-0 sm:ml-4">
                    Review & Accept
                  </Button>
                </div>
              ))}
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
            <div className="space-y-2 pt-2">
              {userSuggestions.map(suggestion => (
                <div key={suggestion.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-md bg-card border border-primary/30">
                  <div className="flex flex-col space-y-1 flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">{getDeltaPreview(suggestion.content)}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatTimestamp(suggestion.timestamp)}</span>
                        <span className="text-yellow-500">Pending Review</span>
                    </div>
                  </div>
                  {/* No action button for users' own suggestions */}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      )}
      
      {/* 3. General Pending Suggestions (Visible to ALL non-editors, including non-connected users) */}
      {!isWhitelistedEditor && pendingSuggestions.length > 0 && (
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
            <div className="space-y-2 pt-2">
              {pendingSuggestions.map(suggestion => (
                <div key={suggestion.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-md bg-card border border-muted-foreground/30">
                  <div className="flex flex-col space-y-1 flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">{getDeltaPreview(suggestion.content)}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UserDisplay address={suggestion.sender} textSizeClass="text-xs" avatarSizeClass="h-4 w-4" linkTo={`/profile/${suggestion.sender}`} />
                        <span>{formatTimestamp(suggestion.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      )}
    </div>
  );
}