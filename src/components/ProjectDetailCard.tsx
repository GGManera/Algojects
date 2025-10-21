"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Project, ProjectsData, Review } from "@/types/social";
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
import { AlertTriangle, Link as LinkIcon, Copy, Gem, UserCircle, X, Edit, Heart, MessageCircle, MessageSquare, FileText, TrendingUp, DollarSign } from "lucide-react";
import { UserDisplay } from "./UserDisplay";
import { Button } from "./ui/button";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { parseProjectMetadata, extractDomainFromUrl, extractXHandleFromUrl } from '@/lib/utils';
import { fetchAssetHolders } from '@/lib/allo';
import { useCuratorIndex } from '@/hooks/useCuratorIndex';
import { MetadataItem } from '@/types/project';
import { ThankContributorDialog } from "./ThankContributorDialog";
import { thankContributorAndClaimProject } from "@/lib/coda";
import { useWallet } from "@txnlab/use-wallet-react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { ProjectMetadataNavigator } from "./ProjectMetadataNavigator";
import { cn } from '@/lib/utils';

const INDEXER_URL = "https://mainnet-idx.algode.cloud";

interface ProjectDetailCardProps {
  project: Project;
  projectsData: ProjectsData;
  activeAddress: string | undefined;
  onInteractionSuccess: () => void;
  currentProjectName: string;
  isInsideCarousel?: boolean;
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean;
  setLastActiveId: ReturnType<typeof useKeyboardNavigation>['setLastActiveId'];
  setFocusedId: ReturnType<typeof useKeyboardNavigation>['setFocusedId'];
  onScrollToTop?: () => void;
}

interface ProjectStats {
  interactionScore: number;
  reviewsCount: number;
  commentsCount: number;
  repliesCount: number;
  likesCount: number;
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
  const [showProjectDetailsForm, setShowProjectDetailsForm] = useState(false);
  const [showThankContributorDialog, setShowThankContributorDialog] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [viewMode, setViewMode] = useState<'reviews' | 'comments' | 'replies' | 'interactions'>('reviews');
  const [isMetadataNavigatorFocused, setIsMetadataNavigatorFocused] = useState(false);
  const { allCuratorData } = useCuratorIndex(undefined, projectsData);

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

  const assetIdItem = projectMetadata.find(item => item.type === 'asset-id' || (!isNaN(parseInt(item.value)) && parseInt(item.value) > 0));
  const assetId = assetIdItem?.value ? parseInt(assetIdItem.value, 10) : undefined;
  const round = (project as any).round;

  const [assetHolders, setAssetHolders] = useState<Map<string, number>>(new Map());
  const [tokenHoldingsLoading, setTokenHoldingsLoading] = useState(true);
  const [assetHoldersError, setAssetHoldersError] = useState<string | null>(null);

  useEffect(() => {
    console.log(`[ProjectDetailCard] Checking Allo API fetch condition: assetId=${assetId}, round=${round}`);
    if (!assetId || !round) {
      setTokenHoldingsLoading(false);
      setAssetHolders(new Map());
      return;
    }

    let isMounted = true;
    const getHolders = async () => {
      if (isMounted) {
        setTokenHoldingsLoading(true);
        setAssetHoldersError(null);
      }
      try {
        const holdersMap = await fetchAssetHolders(assetId, round);
        if (isMounted) setAssetHolders(holdersMap);
      } catch (err) {
        console.error(err);
        if (isMounted) setAssetHoldersError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        if (isMounted) setTokenHoldingsLoading(false);
      }
    };

    getHolders();
    return () => { isMounted = false; };
  }, [assetId, round]);

  const [copiedMetadata, setCopiedMetadata] = useState(false);

  const currentProjectName = projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${projectId}`;
  const currentProjectDescription = projectMetadata.find(item => item.type === 'project-description')?.value;
  const currentProjectTags = projectMetadata.find(item => item.type === 'tags')?.value;
  const isCreatorAdded = projectMetadata.find(item => item.type === 'is-creator-added')?.value === 'true';
  const addedByAddressCoda = projectMetadata.find(item => item.type === 'added-by-address')?.value;
  const isClaimed = projectMetadata.find(item => item.type === 'is-claimed')?.value === 'true';
  const isCommunityNotes = projectMetadata.find(item => item.type === 'is-community-notes')?.value === 'true';
  const creatorWalletItem = projectMetadata.find(item => item.type === 'address' && item.title === 'Creator Wallet');
  const creatorWalletMetadata = creatorWalletItem?.value;
  const addedByAddress = addedByAddressCoda || project.creatorWallet;
  const effectiveCreatorAddress = creatorWalletMetadata || project.creatorWallet;

  const handleProjectDetailsUpdated = () => {
    // Logic remains the same
  };

  const isAuthorizedToClaim = activeAddress && effectiveCreatorAddress && activeAddress === effectiveCreatorAddress && !isClaimed && addedByAddress && activeAddress !== addedByAddress;

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

  const currentUserProjectHolding = useMemo(() => {
    if (!activeAddress || !assetId || tokenHoldingsLoading || !assetHolders) return null;
    const amount = assetHolders.get(activeAddress) || 0;
    const assetUnitNameItem = projectMetadata.find(item => item.type === 'asset-unit-name');
    return { projectId, projectName: currentProjectName, assetId, amount, assetUnitName: assetUnitNameItem?.value || '' };
  }, [activeAddress, assetId, tokenHoldingsLoading, assetHolders, projectId, currentProjectName, projectMetadata]);

  const projectSourceContext = useMemo(() => ({ path: `/project/${projectId}`, label: currentProjectName }), [projectId, currentProjectName]);
  const addedByAddressHoldings = useMemo(() => {
    if (!addedByAddress || !assetId || !assetHolders) return new Map<string, number>();
    return new Map<string, number>().set(projectId, assetHolders.get(addedByAddress) || 0);
  }, [addedByAddress, assetId, assetHolders, projectId]);
  const currentUserHoldingsForProject = useMemo(() => {
    if (!activeAddress || !assetId || !assetHolders) return new Map<string, number>();
    return new Map<string, number>().set(projectId, assetHolders.get(activeAddress) || 0);
  }, [activeAddress, assetId, assetHolders, projectId]);

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
    <div className="w-full">
      <Card className={cn("bg-accent mt-8 relative border-2 border-transparent transition-all duration-200", isFocused && !isMetadataNavigatorFocused ? "focus-glow-border" : "", !isFocused && "hover:focus-glow-border")} data-nav-id={project.id} onMouseEnter={() => setLastActiveId(project.id)} onMouseLeave={() => setLastActiveId(null)}>
        {activeAddress && <Button variant="ghost" size="icon" onClick={() => setShowProjectDetailsForm(prev => !prev)} className="absolute top-2 left-2 z-10 h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Toggle project details form"><Edit className="h-4 w-4" /></Button>}
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col md:flex-row md:items-stretch md:space-x-4">
            <div className="w-full md:w-1/3 flex-col md:justify-center pb-4 md:pb-0 md:pr-4 hidden md:flex">{StatsGrid}</div>
            <div className="w-full md:w-2/3">
              <Card className="bg-card shadow-deep-md">
                <CardHeader className="text-center relative px-4 pt-4 pb-4">
                  <CardTitle className="text-4xl font-bold gradient-text">{currentProjectName}</CardTitle>
                  <CardDescription>{stats.reviewsCount} {stats.reviewsCount === 1 ? 'review' : 'reviews'} found for this project.</CardDescription>
                  {currentProjectTags && <div className="flex flex-wrap justify-center gap-2 mt-1">{currentProjectTags.split(',').map(tag => tag.trim()).filter(Boolean).map((tag, index) => <span key={index} className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary-foreground">{tag}</span>)}</div>}
                  {isAuthorizedToClaim && addedByAddress && effectiveCreatorAddress && <div className="mt-2"><Button onClick={() => setShowThankContributorDialog(true)} disabled={isClaiming} className="bg-green-600 hover:bg-green-700 text-white"><DollarSign className="h-4 w-4 mr-2" /> Thank Contributor & Claim</Button></div>}
                  {addedByAddress && <div className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-1">Added by <UserDisplay address={addedByAddress} textSizeClass="text-sm" avatarSizeClass="h-6 w-6" linkTo={`/profile/${addedByAddress}`} sourceContext={projectSourceContext} projectTokenHoldings={addedByAddressHoldings} writerHoldingsLoading={tokenHoldingsLoading} /></div>}
                  <div className="px-2 pt-8 md:hidden">{StatsGrid}</div>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4 pt-2">
                  <div className="space-y-4">
                    <ProjectMetadataNavigator projectId={projectId} projectMetadata={projectMetadata} currentUserProjectHolding={currentUserProjectHolding} tokenHoldingsLoading={tokenHoldingsLoading} projectSourceContext={projectSourceContext} isParentFocused={isFocused && !isMetadataNavigatorFocused} onFocusTransfer={handleFocusTransfer} onFocusReturn={handleFocusReturn} setParentFocusedId={setFocusedId} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <ProjectNotesDisplay isLoadingDetails={isLoadingDetails} detailsError={detailsError} currentProjectDescription={currentProjectDescription} isCommunityNotes={isCommunityNotes} isCreatorAdded={isCreatorAdded} addedByAddress={addedByAddress} />
          {activeAddress && showProjectDetailsForm && <ProjectDetailsForm projectId={projectId} initialProjectMetadata={projectMetadata} projectCreatorAddress={effectiveCreatorAddress} onProjectDetailsUpdated={handleProjectDetailsUpdated} />}
        </CardContent>
      </Card>
      <div className="space-y-6 mt-8">
        {sortedReviews.length > 0 ? sortedReviews.map(({ review, score }) => <ReviewItem key={review.id} review={review} project={project} onInteractionSuccess={onInteractionSuccess} interactionScore={score} writerTokenHoldings={currentUserHoldingsForProject} writerHoldingsLoading={tokenHoldingsLoading} projectSourceContext={projectSourceContext} allCuratorData={allCuratorData} focusedId={focusedId} registerItem={registerItem} isActive={isActive} setLastActiveId={setLastActiveId} globalViewMode={viewMode} />) : <p className="text-muted-foreground text-center">No reviews yet for this project.</p>}
        {activeAddress && <NewReviewForExistingProjectForm project={project} projectsData={projectsData} onInteractionSuccess={onInteractionSuccess} />}
      </div>
      {isAuthorizedToClaim && addedByAddress && effectiveCreatorAddress && <ThankContributorDialog isOpen={showThankContributorDialog} onOpenChange={setShowThankContributorDialog} projectId={projectId} projectName={currentProjectName} contributorAddress={addedByAddress} projectCreatorAddress={effectiveCreatorAddress} initialMetadata={projectMetadata} onConfirm={handleClaimProject} isConfirming={isClaiming} />}
    </div>
  );
}