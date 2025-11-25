"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Project, ProjectsData, Review, ProposedNoteEdit } from "@/types/social";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReviewItem } from "./ReviewItem";
import { NewReviewForExistingProjectForm } from "./NewReviewForExistingProjectForm";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { ProjectDetailsForm } from "./ProjectDetailsForm";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Link as LinkIcon, Copy, Gem, UserCircle, X, Edit, Heart, MessageCircle, MessageSquare, FileText, TrendingUp, DollarSign, Hash, ChevronDown, ChevronUp } from "lucide-react";
import { UserDisplay } from "./UserDisplay";
import { Button } from "@/components/ui/button";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { parseProjectMetadata, extractDomainFromUrl, extractXHandleFromUrl } from '@/lib/utils';
import { fetchAssetBalanceAtRound } from '@/lib/allo';
import { useCuratorIndex } from '@/hooks/useCuratorIndex';
import { MetadataItem } from '@/types/project';
import { ThankContributorDialog } from "./ThankContributorDialog";
import { thankContributorAndClaimProject } from "@/lib/coda";
import { useWallet } from "@txnlab/use-wallet-react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { ProjectMetadataNavigator } from "./ProjectMetadataNavigator";
import { cn } from '@/lib/utils';
import { ProjectMetadataSuggestionForm } from "./ProjectMetadataSuggestionForm";
import { AcceptMetadataSuggestionDialog } from "./AcceptMetadataSuggestionDialog";
import { CollapsibleContent } from "./CollapsibleContent";
import { MetadataSuggestionSelector } from "./MetadataSuggestionSelector";
import { ProjectMetadataSuggestionsList } from "./ProjectMetadataSuggestionsList";
import { useNfdResolver } from "@/hooks/useNfdResolver"; // NEW: Import useNfdResolver

const INDEXER_URL = "https://mainnet-idx.algode.cloud";

interface ProjectStats {
  interactionScore: number;
  reviewsCount: number;
  commentsCount: number;
  repliesCount: number;
  likesCount: number;
}

interface CurrentUserProjectHolding {
  assetId: number;
  amount: number;
  assetUnitName: string;
}

const getReviewInteractionScore = (review: Review): number => {
  let score = review.likeCount || 0;
  const comments = Object.values(review.comments || {});
  score += comments.length;
  comments.forEach(comment => {
    score += comment.likeCount || 0;
    const replies = Object.values(comment.replies || {});
    score += replies.length;
    replies.forEach(reply => {
      score += reply.likeCount || 0;
    });
  });
  return score;
};

const ProjectNotesDisplay = ({
  isLoadingDetails,
  detailsError,
  currentProjectDescription,
  isCommunityNotes,
  isCreatorAdded,
  addedByAddress,
}: {
  isLoadingDetails: boolean;
  detailsError: string | null;
  currentProjectDescription: string | undefined;
  isCommunityNotes: boolean;
  isCreatorAdded: boolean;
  addedByAddress: string | undefined;
}) => {
  if (!isLoadingDetails && (!currentProjectDescription || currentProjectDescription.trim() === '')) {
    return null;
  }
  let notesLabel = "Notes";
  if (isCommunityNotes) notesLabel = "Community Notes";
  else if (isCreatorAdded) notesLabel = "Creator Notes";
  else if (addedByAddress) notesLabel = "Contributor Notes";

  return (
    <div className="py-4 px-4 bg-gradient-to-r from-notes-gradient-start to-notes-gradient-end text-black rounded-md shadow-recessed">
      <h3 className="text-lg font-semibold mb-2 text-black">{notesLabel}:</h3>
      {isLoadingDetails ? (
        <Skeleton className="h-20 w-full" />
      ) : detailsError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{detailsError}</AlertDescription>
        </Alert>
      ) : (
        <p className="text-black/90 whitespace-pre-wrap selectable-text">{currentProjectDescription}</p>
      )}
    </div>
  );
};

interface ProjectDetailCardProps {
  project: Project;
  projectsData: ProjectsData;
  activeAddress: string | undefined;
  onInteractionSuccess: () => void;
  isInsideCarousel?: boolean;
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean;
  setLastActiveId: ReturnType<typeof useKeyboardNavigation>['setLastActiveId'];
  setFocusedId: ReturnType<typeof useKeyboardNavigation>['setFocusedId'];
  onScrollToTop?: () => void;
}

export function ProjectDetailCard({ 
  project, 
  projectsData, 
  activeAddress, 
  onInteractionSuccess, 
  isInsideCarousel = false, 
  focusedId, 
  registerItem,
  isActive,
  setLastActiveId,
  setFocusedId,
  onScrollToTop = () => {},
}: ProjectDetailCardProps) {
  const projectId = project.id;
  const { transactionSigner, algodClient } = useWallet();
  const { projectDetails, loading, isRefreshing, error: detailsError, refetch: refetchProjectDetails } = useProjectDetails();
  const isLoadingDetails = loading || isRefreshing;
  
  // State for Admin/Whitelisted Editor Direct Edit Form
  const [showProjectDetailsForm, setShowProjectDetailsForm] = useState(false);
  
  // States for Regular User Suggestion Flow
  const [showMetadataSuggestionForm, setShowMetadataSuggestionForm] = useState(false);
  const [isSuggestionSelectorOpen, setIsSuggestionSelectorOpen] = useState(false);
  const [itemToSuggestEdit, setItemToSuggestEdit] = useState<MetadataItem | undefined>(undefined);
  
  // State for Pending Suggestions List (Visible to Whitelisted Editors)
  const [selectedSuggestion, setSelectedSuggestion] = useState<ProposedNoteEdit | null>(null);
  
  const [showThankContributorDialog, setShowThankContributorDialog] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [viewMode, setViewMode] = useState<'reviews' | 'comments' | 'replies' | 'interactions'>('reviews');
  const [isMetadataNavigatorFocused, setIsMetadataNavigatorFocused] = useState(false);
  const { allCuratorData } = useCuratorIndex(undefined, projectsData);

  const [currentUserHolding, setCurrentUserHolding] = useState<CurrentUserProjectHolding | null>(null);
  const [tokenHoldingsLoading, setTokenHoldingsLoading] = useState(true);
  const [assetHoldersError, setAssetHoldersError] = useState<string | null>(null);
  
  const stats: ProjectStats = useMemo(() => {
    let reviewsCount = 0, commentsCount = 0, repliesCount = 0, likesCount = 0;
    const reviews = Object.values(project.reviews || {});
    reviewsCount = reviews.length;
    reviews.forEach(review => {
      likesCount += review.likeCount || 0;
      const comments = Object.values(review.comments || {});
      commentsCount += comments.length;
      comments.forEach(comment => {
        likesCount += comment.likeCount || 0;
        const replies = Object.values(comment.replies || {});
        repliesCount += replies.length;
        replies.forEach(reply => {
          likesCount += reply.likeCount || 0;
        });
      });
    });
    const interactionScore = reviewsCount + commentsCount + repliesCount + likesCount;
    return { interactionScore, reviewsCount, commentsCount, repliesCount, likesCount };
  }, [project]);

  const sortedReviews = useMemo(() => {
    return Object.values(project.reviews || {})
      .map(review => ({ review, score: getReviewInteractionScore(review) }))
      .sort((a, b) => b.score - a.score);
  }, [project.reviews]);

  const currentProjectDetailsEntry = projectDetails.find(entry => entry.projectId === projectId);
  const projectMetadata: MetadataItem[] = currentProjectDetailsEntry?.projectMetadata || [];
  const pendingSuggestions = Object.values(project.proposedNoteEdits || []);

  const assetIdItem = projectMetadata.find(item => item.type === 'asset-id' || (!isNaN(parseInt(item.value)) && parseInt(item.value) > 0));
  const assetId = assetIdItem?.value ? parseInt(assetIdItem.value, 10) : undefined;
  const round = project.round;

  // NEW: Effect to fetch current user's asset balance
  useEffect(() => {
    if (!activeAddress || !assetId || !round) {
      setCurrentUserHolding(null);
      setTokenHoldingsLoading(false);
      return;
    }

    let isMounted = true;
    const getBalance = async () => {
      if (isMounted) {
        setTokenHoldingsLoading(true);
        setAssetHoldersError(null);
      }
      try {
        const balanceData = await fetchAssetBalanceAtRound(activeAddress, assetId, round);
        
        const assetUnitNameItem = projectMetadata.find(item => item.type === 'asset-unit-name');
        
        if (isMounted) {
          setCurrentUserHolding({
            assetId,
            amount: balanceData.amount,
            assetUnitName: balanceData.unitName || assetUnitNameItem?.value || '',
          });
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setAssetHoldersError(err instanceof Error ? err.message : 'An unknown error occurred');
          setCurrentUserHolding(null);
        }
      } finally {
        if (isMounted) setTokenHoldingsLoading(false);
      }
    };

    getBalance();
    return () => { isMounted = false; };
  }, [activeAddress, assetId, round, projectId, projectMetadata]);

  const currentProjectName = projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${projectId}`;
  const currentProjectDescription = projectMetadata.find(item => item.type === 'project-description')?.value;
  const currentProjectTags = projectMetadata.find(item => item.type === 'tags')?.value;
  const isCreatorAdded = projectMetadata.find(item => item.type === 'is-creator-added')?.value === 'true';
  const addedByAddressCoda = projectMetadata.find(item => item.type === 'added-by-address')?.value;
  const isClaimed = projectMetadata.find(item => item.type === 'is-claimed')?.value === 'true';
  const isCommunityNotes = projectMetadata.find(item => item.type === 'is-community-notes')?.value === 'true';
  const creatorWalletItem = projectMetadata.find(item => item.type === 'address' && item.title === 'Creator Wallet');
  const projectWalletItem = projectMetadata.find(item => item.type === 'project-wallet');
  const creatorWalletMetadata = creatorWalletItem?.value;
  const projectWalletMetadata = projectWalletItem?.value;
  
  const addedByAddress = addedByAddressCoda || project.creatorWallet;
  
  const effectiveCreatorAddress = creatorWalletMetadata || projectWalletMetadata || project.creatorWallet;

  const handleProjectDetailsUpdated = () => {
    refetchProjectDetails();
    onInteractionSuccess();
  };

  // --- Authorization Logic ---
  const whitelistedEditors = useMemo(() => {
    const editors = projectMetadata.find(item => item.type === 'whitelisted-editors')?.value || '';
    return editors.split(',').map(addr => addr.trim()).filter(Boolean);
  }, [projectMetadata]);

  // NEW: Resolve whitelisted editors to canonical addresses
  const { resolvedAddresses: resolvedWhitelistedEditors, loading: resolvingEditors } = useNfdResolver(whitelistedEditors);

  const isWhitelistedEditor = useMemo(() => {
    if (!activeAddress || resolvingEditors) return false;
    // Check if activeAddress is in the set of resolved addresses
    return resolvedWhitelistedEditors.has(activeAddress);
  }, [activeAddress, resolvedWhitelistedEditors, resolvingEditors]);

  // Determine if the current user is the effective creator (for claiming)
  const isEffectiveCreator = activeAddress && effectiveCreatorAddress && activeAddress === effectiveCreatorAddress;

  // Determine if the project is claimable (creator wallet matches active address, but project is not claimed, and was added by someone else)
  const isClaimable = isEffectiveCreator && !isClaimed && addedByAddress && activeAddress !== addedByAddress;

  const handleClaimProject = useCallback(async (totalRewardAlgos: number, contributorShare: number, newWhitelistedEditors: string) => {
    if (!activeAddress || !transactionSigner || !algodClient || !addedByAddress || !effectiveCreatorAddress) {
      showError("Wallet not connected or missing project data.");
      return;
    }
    setIsClaiming(true);
    const toastId = showLoading("Preparing claim transaction...");
    try {
      await thankContributorAndClaimProject(projectId, currentProjectName, addedByAddress, totalRewardAlgos, contributorShare, newWhitelistedEditors, projectMetadata, activeAddress, transactionSigner, algodClient);
      dismissToast(toastId);
      showSuccess("Project claimed and contributor rewarded successfully!");
      setShowThankContributorDialog(false);
      refetchProjectDetails(); 
      onInteractionSuccess();
    } catch (err) {
      dismissToast(toastId);
      console.error("Claim failed:", err);
      showError(err instanceof Error ? err.message : "Failed to claim project and reward contributor.");
    } finally {
      setIsClaiming(false);
    }
  }, [activeAddress, transactionSigner, algodClient, addedByAddress, projectId, currentProjectName, projectMetadata, refetchProjectDetails, onInteractionSuccess, effectiveCreatorAddress]);

  const currentUserProjectHoldingProp = useMemo(() => {
    if (!currentUserHolding || currentUserHolding.amount === 0) return null;
    return {
      projectId,
      projectName: currentProjectName,
      assetId: currentUserHolding.assetId,
      amount: currentUserHolding.amount,
      assetUnitName: currentUserHolding.assetUnitName,
    };
  }, [currentUserHolding, projectId, currentProjectName]);

  const projectSourceContext = useMemo(() => ({ path: `/project/${projectId}`, label: currentProjectName }), [projectId, currentProjectName]);
  
  const isFocused = focusedId === project.id;
  const handleToggleExpand = useCallback(() => {
    if (!isMetadataNavigatorFocused) setIsMetadataNavigatorFocused(true);
    onScrollToTop();
  }, [isMetadataNavigatorFocused, onScrollToTop]);

  useEffect(() => {
    const cleanup = registerItem(project.id, handleToggleExpand, true, 'project-summary');
    return cleanup;
  }, [project.id, handleToggleExpand, registerItem, isActive]);

  const handleFocusReturn = useCallback((direction: 'up' | 'down') => {
    setIsMetadataNavigatorFocused(false);
    setFocusedId(project.id);
    const key = direction === 'down' ? 'ArrowDown' : 'ArrowUp';
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }, [project.id, setFocusedId]);

  const handleFocusTransfer = useCallback((isInternal: boolean) => setIsMetadataNavigatorFocused(isInternal), []);

  useEffect(() => {
    if (isFocused && !isMetadataNavigatorFocused) {
      const handleSpacebar = (e: KeyboardEvent) => {
        if (e.key === ' ') {
          e.preventDefault();
          const hasNavItems = projectMetadata.filter(item => !['project-name', 'project-description', 'whitelisted-editors', 'is-creator-added', 'added-by-address', 'is-community-notes', 'tags', 'is-claimed', 'project-wallet'].includes(item.type || '') && !(item.type === 'address' && item.title === 'Creator Wallet')).length > 0;
          if (hasNavItems) setIsMetadataNavigatorFocused(true);
          else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        }
      };
      window.addEventListener('keydown', handleSpacebar);
      return () => window.removeEventListener('keydown', handleSpacebar);
    }
  }, [isFocused, isMetadataNavigatorFocused, projectMetadata]);

  const handleViewModeClick = useCallback((mode: 'reviews' | 'comments' | 'replies' | 'interactions') => setViewMode(mode), []);

  // --- Suggestion Selector Handlers ---
  const handleSelectEditExisting = useCallback((item: MetadataItem) => {
    setItemToSuggestEdit(item);
    setIsSuggestionSelectorOpen(false);
    setShowMetadataSuggestionForm(true);
  }, []);

  const handleSelectNewSuggestion = useCallback(() => {
    setItemToSuggestEdit(undefined); // Undefined means 'Add New' mode
    setIsSuggestionSelectorOpen(false);
    setShowMetadataSuggestionForm(true);
  }, []);

  const handleCancelSuggestionForm = useCallback(() => {
    setShowMetadataSuggestionForm(false);
    setIsSuggestionSelectorOpen(true); // Go back to selector
    setItemToSuggestEdit(undefined);
  }, []);

  // --- Edit/Suggest Button Click Handler ---
  const handleEditButtonClick = () => {
    // Close all other forms/selectors first
    setShowProjectDetailsForm(false);
    setShowMetadataSuggestionForm(false);
    setIsSuggestionSelectorOpen(false);

    if (isWhitelistedEditor) {
      // Whitelisted Editor: Toggle Direct Edit Form
      setShowProjectDetailsForm(prev => !prev);
    } else {
      // Regular User: Toggle Suggestion Selector
      setIsSuggestionSelectorOpen(prev => !prev);
    }
  };

  const handleReviewSuggestion = useCallback((suggestion: ProposedNoteEdit) => {
    setSelectedSuggestion(suggestion);
  }, []);

  const StatsGrid = (
    <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2 md:w-full">
      <div className={cn("flex flex-col items-center space-y-1 cursor-pointer transition-colors hover:bg-muted/50 rounded-lg p-2 col-span-2", viewMode === 'interactions' && "bg-primary/20 border border-primary")} onClick={() => handleViewModeClick('interactions')}>
        <TrendingUp className="h-5 w-5 text-hodl-blue" />
        <span className="font-bold font-numeric text-foreground">{stats.interactionScore}</span>
        <span>Interactions</span>
      </div>
      <div className="grid gap-4 text-sm text-muted-foreground grid-cols-2 col-span-2">
        <div className="flex flex-col items-center space-y-4">
          <div className={cn("flex flex-col items-center space-y-1 cursor-pointer transition-colors hover:bg-muted/50 rounded-lg p-2", viewMode === 'reviews' && "bg-primary/20 border border-primary")} onClick={() => handleViewModeClick('reviews')}>
            <FileText className="h-5 w-5 text-hodl-purple" />
            <span className="font-bold font-numeric text-foreground">{stats.reviewsCount}</span>
            <span>Reviews</span>
          </div>
          <div className={cn("flex flex-col items-center space-y-1 cursor-pointer transition-colors hover:bg-muted/50 rounded-lg p-2", viewMode === 'replies' && "bg-primary/20 border border-primary")} onClick={() => handleViewModeClick('replies')}>
            <MessageSquare className="h-5 w-5 text-hodl-purple" />
            <span className="font-bold font-numeric text-foreground">{stats.repliesCount}</span>
            <span>Replies</span>
          </div>
        </div>
        <div className="flex flex-col items-center space-y-4">
          <div className={cn("flex flex-col items-center space-y-1 cursor-pointer transition-colors hover:bg-muted/50 rounded-lg p-2", viewMode === 'comments' && "bg-primary/20 border border-primary")} onClick={() => handleViewModeClick('comments')}>
            <MessageCircle className="h-5 w-5 text-hodl-purple" />
            <span className="font-bold font-numeric text-foreground">{stats.commentsCount}</span>
            <span>Comments</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <Heart className="h-5 w-5 text-pink-400" />
            <span className="font-bold font-numeric text-foreground">{stats.likesCount}</span>
            <span>Likes</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Card className={cn(
        "bg-accent mt-8 relative transition-all duration-200", 
        isFocused && !isMetadataNavigatorFocused ? "focus-glow-border" : "", 
        !isFocused && "hover:focus-glow-border",
        // NEW: Remove rounded corners and horizontal border/margin on mobile
        isInsideCarousel && "rounded-none border-x-0",
      )} data-nav-id={project.id} onMouseEnter={() => setLastActiveId(project.id)} onMouseLeave={() => setLastActiveId(null)}>
        
        {/* Dynamic Edit/Suggest Button */}
        {activeAddress && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleEditButtonClick} 
            className="absolute top-2 left-2 z-10 h-8 w-8 text-muted-foreground hover:text-foreground" 
            aria-label={isWhitelistedEditor ? "Toggle project details form" : "Toggle metadata suggestion selector"}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col md:flex-row md:items-stretch md:space-x-4">
            <div className="w-full md:w-1/3 flex-col md:justify-center pb-4 md:pb-0 md:pr-4 hidden md:flex">{StatsGrid}</div>
            <div className="w-full md:w-2/3">
              <Card className="bg-card shadow-deep-md">
                <CardHeader className="text-center relative px-4 pt-4 pb-4">
                  <CardTitle className="text-4xl font-bold gradient-text">{currentProjectName}</CardTitle>
                  <CardDescription>{stats.reviewsCount} {stats.reviewsCount === 1 ? 'review' : 'reviews'} found for this project.</CardDescription>
                  {currentProjectTags && <div className="flex flex-wrap justify-center gap-2 mt-1">{currentProjectTags.split(',').map(tag => tag.trim()).filter(Boolean).map((tag, index) => <span key={index} className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary-foreground">{tag}</span>)}</div>}
                  
                  {/* Claim Button */}
                  {isClaimable && addedByAddress && effectiveCreatorAddress && (
                    <div className="mt-2">
                      <Button onClick={() => setShowThankContributorDialog(true)} disabled={isClaiming} className="bg-green-600 hover:bg-green-700 text-white">
                        <DollarSign className="h-4 w-4 mr-2" /> Claim Project Page
                      </Button>
                    </div>
                  )}
                  {isClaimed && <p className="text-sm text-green-400 mt-2 font-semibold">Project Page Claimed</p>}

                  {addedByAddress && <div className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-1">Added by <UserDisplay address={addedByAddress} textSizeClass="text-sm" avatarSizeClass="h-6 w-6" linkTo={`/profile/${addedByAddress}`} sourceContext={projectSourceContext} isTokenHolder={false} /></div>}
                  <div className="px-2 pt-8 md:hidden">{StatsGrid}</div>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4 pt-2">
                  <div className="space-y-4">
                    <ProjectMetadataNavigator 
                      projectId={projectId} 
                      projectMetadata={projectMetadata} 
                      currentUserProjectHolding={currentUserProjectHoldingProp}
                      tokenHoldingsLoading={tokenHoldingsLoading} 
                      projectSourceContext={projectSourceContext} 
                      isParentFocused={isFocused && !isMetadataNavigatorFocused} 
                      onFocusTransfer={handleFocusTransfer} 
                      onFocusReturn={handleFocusReturn} 
                      setParentFocusedId={setFocusedId} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <ProjectNotesDisplay isLoadingDetails={isLoadingDetails} detailsError={detailsError} currentProjectDescription={currentProjectDescription} isCommunityNotes={isCommunityNotes} isCreatorAdded={isCreatorAdded} addedByAddress={addedByAddress} />
          
          {/* Metadata Edit/Suggestion Forms */}
          <div className="space-y-4">
            {isWhitelistedEditor ? (
              <>
                {/* 1. Whitelisted Editor: Direct Edit Form */}
                <CollapsibleContent isOpen={showProjectDetailsForm}>
                  <ProjectDetailsForm 
                    projectId={projectId} 
                    initialProjectMetadata={projectMetadata} 
                    projectCreatorAddress={effectiveCreatorAddress} 
                    onProjectDetailsUpdated={handleProjectDetailsUpdated} 
                  />
                </CollapsibleContent>
              </>
            ) : (
              <>
                {/* Regular User: Suggestion Selector */}
                <CollapsibleContent isOpen={isSuggestionSelectorOpen}>
                  <MetadataSuggestionSelector
                    initialMetadata={projectMetadata}
                    onSelectEdit={handleSelectEditExisting}
                    onSelectNew={handleSelectNewSuggestion}
                    disabled={!activeAddress}
                  />
                </CollapsibleContent>

                {/* Regular User: Suggestion Form (Hidden until item is selected or new is chosen) */}
                <CollapsibleContent isOpen={showMetadataSuggestionForm}>
                  <ProjectMetadataSuggestionForm 
                    project={project} 
                    onInteractionSuccess={onInteractionSuccess} 
                    initialMetadata={projectMetadata}
                    onCancel={handleCancelSuggestionForm}
                    initialItem={itemToSuggestEdit}
                  />
                </CollapsibleContent>
              </>
            )}
            
            {/* 3. Suggestions List (Visible to everyone, but actions only for editors) */}
            <ProjectMetadataSuggestionsList
                project={project}
                currentProjectMetadata={projectMetadata}
                onReviewSuggestion={handleReviewSuggestion}
                isWhitelistedEditor={isWhitelistedEditor}
                onInteractionSuccess={onInteractionSuccess}
            />
          </div>

        </CardContent>
      </Card>
      <div className="space-y-6 mt-8">
        {sortedReviews.length > 0 ? sortedReviews.map(({ review, score }) => <ReviewItem key={review.id} review={review} project={project} onInteractionSuccess={onInteractionSuccess} interactionScore={score} projectSourceContext={projectSourceContext} allCuratorData={allCuratorData} focusedId={focusedId} registerItem={registerItem} isActive={isActive} setLastActiveId={setLastActiveId} globalViewMode={viewMode} />) : <p className="text-muted-foreground text-center">No reviews yet for this project.</p>}
        {activeAddress && <NewReviewForExistingProjectForm project={project} projectsData={projectsData} onInteractionSuccess={onInteractionSuccess} />}
      </div>
      
      {/* Dialogs */}
      {isClaimable && addedByAddress && effectiveCreatorAddress && (
        <ThankContributorDialog 
          isOpen={showThankContributorDialog} 
          onOpenChange={setShowThankContributorDialog} 
          projectId={projectId} 
          projectName={currentProjectName} 
          contributorAddress={addedByAddress} 
          projectCreatorAddress={effectiveCreatorAddress} 
          initialMetadata={projectMetadata} 
          onConfirm={handleClaimProject} 
          isConfirming={isClaiming} 
        />
      )}
      {selectedSuggestion && (
        <AcceptMetadataSuggestionDialog
          isOpen={!!selectedSuggestion}
          onOpenChange={() => setSelectedSuggestion(null)}
          suggestion={selectedSuggestion}
          project={project}
          currentProjectMetadata={projectMetadata}
          onInteractionSuccess={() => {
            setSelectedSuggestion(null);
            refetchProjectDetails();
            onInteractionSuccess();
          }}
        />
      )}
    </>
  );
}