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
import { useUserProjectTokenHoldings } from '@/hooks/useUserProjectTokenHoldings';
import { useAssetHoldingsForUsers } from '@/hooks/useAssetHoldingsForUsers';
import { cn } from '@/lib/utils';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { useCuratorIndex } from '@/hooks/useCuratorIndex';
import { MetadataItem } from '@/types/project';
import { ThankContributorDialog } from "./ThankContributorDialog";
import { thankContributorAndClaimProject } from "@/lib/coda";
import { useWallet } from "@txnlab/use-wallet-react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { ProjectMetadataNavigator } from "./ProjectMetadataNavigator"; // NEW Import
import { GlassRadioGroup, GlassRadioItem } from "@/components/GlassRadioGroup"; // Import GlassRadioGroup

const INDEXER_URL = "https://mainnet-idx.algode.cloud";

interface ProjectDetailCardProps {
  project: Project;
  projectsData: ProjectsData;
  activeAddress: string | undefined;
  onInteractionSuccess: () => void;
  currentProjectName: string;
  isInsideCarousel?: boolean;
  // NEW: Keyboard navigation props
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean;
  setLastActiveId: ReturnType<typeof useKeyboardNavigation>['setLastActiveId'];
  setFocusedId: ReturnType<typeof useKeyboardNavigation>['setFocusedId']; // NEW PROP
}

interface ProjectStats {
  interactionScore: number;
  reviewsCount: number;
  commentsCount: number;
  repliesCount: number;
  likesCount: number;
}

// Helper function to calculate interaction score for a review
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
  setFocusedId // NEW: Destructure setFocusedId
}: ProjectDetailCardProps) {
  const projectId = project.id;
  const { isMobile } = useAppContextDisplayMode();
  const { transactionSigner, algodClient } = useWallet();

  const { projectDetails, loading, isRefreshing, error: detailsError, refetch: refetchProjectDetails } = useProjectDetails();
  const isLoadingDetails = loading || isRefreshing;
  const [copiedMetadata, setCopiedMetadata] = useState(false);

  const [assetUnitName, setAssetUnitName] = useState<string | null>(null);
  const [assetUnitNameLoading, setAssetUnitNameLoading] = useState(false);
  const [assetUnitNameError, setAssetUnitNameError] = useState<string | null>(null);

  const [showAssetIdValue, setShowAssetIdValue] = useState(false);
  const [copiedAssetIdMessage, setCopiedAssetIdMessage] = useState<string | null>(null);
  const [isAssetIdHovered, setIsAssetIdHovered] = useState(false);

  const [showProjectDetailsForm, setShowProjectDetailsForm] = useState(false);
  const [showThankContributorDialog, setShowThankContributorDialog] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  
  // NEW: State for global view mode
  const [viewMode, setViewMode] = useState<'reviews' | 'comments' | 'replies' | 'interactions'>('reviews');
  
  // NEW: State to track if focus is inside the Metadata Navigator
  const [isMetadataNavigatorFocused, setIsMetadataNavigatorFocused] = useState(false);

  const { tokenHoldings, loading: tokenHoldingsLoading } = useUserProjectTokenHoldings(activeAddress, projectsData, projectDetails);
  const { allCuratorData, loading: curatorIndexLoading } = useCuratorIndex(undefined, projectsData);

  const stats: ProjectStats = useMemo(() => {
    let reviewsCount = 0;
    let commentsCount = 0;
    let repliesCount = 0;
    let likesCount = 0;

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
    const reviews = Object.values(project.reviews || {});
    return reviews
      .map(review => ({
        review,
        score: getReviewInteractionScore(review),
      }))
      .sort((a, b) => b.score - a.score);
  }, [project.reviews]);

  const currentProjectDetailsEntry = projectDetails.find(entry => entry.projectId === projectId);
  const projectMetadata: MetadataItem[] = currentProjectDetailsEntry?.projectMetadata || [];

  // Extract "fixed" fields from projectMetadata
  const currentProjectName = projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${projectId}`;
  const currentProjectDescription = projectMetadata.find(item => item.type === 'project-description')?.value;
  const currentProjectTags = projectMetadata.find(item => item.type === 'tags')?.value;
  const isCreatorAdded = projectMetadata.find(item => item.type === 'is-creator-added')?.value === 'true';
  const addedByAddressCoda = projectMetadata.find(item => item.type === 'added-by-address')?.value;
  const isCommunityNotes = projectMetadata.find(item => item.type === 'is-community-notes')?.value === 'true';
  const isClaimed = projectMetadata.find(item => item.type === 'is-claimed')?.value === 'true';
  
  const creatorWalletItem = projectMetadata.find(item => item.type === 'address' && item.title === 'Creator Wallet');
  const creatorWalletMetadata = creatorWalletItem?.value;
  
  const addedByAddress = addedByAddressCoda || project.creatorWallet;
  const effectiveCreatorAddress = creatorWalletMetadata || project.creatorWallet;

  const handleProjectDetailsUpdated = () => {
    refetchProjectDetails();
    onInteractionSuccess();
  };

  const isAuthorizedToClaim = activeAddress && effectiveCreatorAddress && activeAddress === effectiveCreatorAddress && !isClaimed && addedByAddress && activeAddress !== addedByAddress;

  const handleClaimProject = useCallback(async (
    totalRewardAlgos: number,
    contributorShare: number,
    newWhitelistedEditors: string
  ) => {
    if (!activeAddress || !transactionSigner || !algodClient || !addedByAddress || !effectiveCreatorAddress) {
      showError("Wallet not connected or missing project data.");
      return;
    }

    setIsClaiming(true);
    const toastId = showLoading("Preparing claim transaction...");

    try {
      await thankContributorAndClaimProject(
        projectId,
        currentProjectName,
        addedByAddress,
        totalRewardAlgos,
        contributorShare,
        newWhitelistedEditors,
        projectMetadata,
        activeAddress,
        transactionSigner,
        algodClient
      );
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

  const handleCopyAllMetadata = async () => {
    if (projectMetadata.length > 0) {
      try {
        const metadataString = JSON.stringify(projectMetadata, null, 2);
        await navigator.clipboard.writeText(metadataString);
        setCopiedMetadata(true);
        showSuccess("All metadata copied to clipboard!");
        setTimeout(() => setCopiedMetadata(false), 2000);
      } catch (err) {
        console.error("Failed to copy metadata:", err);
        showError("Failed to copy metadata.");
      }
    }
  };

  const assetIdItem = projectMetadata.find(item => item.type === 'asset-id' || (!isNaN(parseInt(item.value)) && parseInt(item.value) > 0));

  useEffect(() => {
    const fetchAssetUnitName = async () => {
      if (!assetIdItem?.value) {
        setAssetUnitName(null);
        return;
      }

      setAssetUnitNameLoading(true);
      setAssetUnitNameError(null);

      try {
        const response = await fetch(`${INDEXER_URL}/v2/assets/${assetIdItem.value}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch asset details for ID ${assetIdItem.value}: ${response.statusText}`);
        }
        const data = await response.json();
        setAssetUnitName(data.asset.params['unit-name'] || null);
      } catch (err) {
        console.error(`Error fetching asset unit name for ${assetIdItem.value}:`, err);
        setAssetUnitNameError(err instanceof Error ? err.message : "Failed to fetch asset unit name.");
        setAssetUnitName(null);
      } finally {
        setAssetUnitNameLoading(false);
      }
    };

    fetchAssetUnitName();
  }, [assetIdItem?.value]);

  const currentUserProjectHolding = useMemo(() => {
    if (!activeAddress || !assetIdItem?.value || tokenHoldingsLoading) return null;
    const assetIdNum = parseInt(assetIdItem.value, 10);
    if (isNaN(assetIdNum)) return null;
    return tokenHoldings.find(holding => holding.projectId === projectId && holding.assetId === assetIdNum);
  }, [activeAddress, assetIdItem?.value, tokenHoldings, tokenHoldingsLoading, projectId]);

  const allWriterAddresses = useMemo(() => {
    const addresses = new Set<string>();
    if (project.creatorWallet) addresses.add(project.creatorWallet);
    if (addedByAddress) addresses.add(addedByAddress);

    Object.values(project.reviews).forEach(review => {
      addresses.add(review.sender);
      Object.values(review.comments).forEach(comment => {
        addresses.add(comment.sender);
        Object.values(comment.replies).forEach(reply => {
          addresses.add(reply.sender);
        });
      });
    });
    return Array.from(addresses);
  }, [project, addedByAddress]);

  const projectAssetIdNum = assetIdItem?.value ? parseInt(assetIdItem.value, 10) : undefined;
  const { holdingsMap: writerTokenHoldings, loading: writerHoldingsLoading } = useAssetHoldingsForUsers(
    allWriterAddresses,
    projectAssetIdNum
  );

  const projectSourceContext = useMemo(() => ({
    path: `/project/${projectId}`,
    label: currentProjectName,
  }), [projectId, currentProjectName]);

  // --- Keyboard Navigation Logic for ProjectDetailCard ---
  const isFocused = focusedId === project.id;
  const isExpanded = true; // ProjectDetailCard is always conceptually expanded

  // 1. Register ProjectDetailCard itself
  const handleToggleExpand = useCallback(() => {
    // When spacebar is pressed on the main card, transfer focus to the metadata navigator
    if (!isMetadataNavigatorFocused) {
      setIsMetadataNavigatorFocused(true);
    }
  }, [isMetadataNavigatorFocused]);

  useEffect(() => {
    // Register the main card. It's always expanded.
    const cleanup = registerItem(project.id, handleToggleExpand, true, 'project-summary');
    return cleanup;
  }, [project.id, handleToggleExpand, registerItem, isActive]);

  // 2. Handle focus return from Metadata Navigator
  const handleFocusReturn = useCallback((direction: 'up' | 'down') => {
    setIsMetadataNavigatorFocused(false);
    setFocusedId(project.id); // Return focus to the main card
    
    // If returning focus, immediately move to the next/previous item outside the card
    if (direction === 'down') {
        // Simulate ArrowDown press to move to the first ReviewItem
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
        document.dispatchEvent(event);
    } else if (direction === 'up') {
        // Simulate ArrowUp press to move to the previous item (which should be the last item before the card)
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
        document.dispatchEvent(event);
    }
  }, [project.id, setFocusedId]); // ADDED setFocusedId dependency

  // 3. Handle focus transfer status from Metadata Navigator
  const handleFocusTransfer = useCallback((isInternal: boolean) => {
    setIsMetadataNavigatorFocused(isInternal);
  }, []);

  // 4. Handle spacebar press on the main card to transfer focus
  useEffect(() => {
    if (isFocused && !isMetadataNavigatorFocused) {
      const handleSpacebar = (e: KeyboardEvent) => {
        if (e.key === ' ') {
          e.preventDefault();
          // Check if the Metadata Navigator has items before transferring focus
          const metadataNavigatorHasItems = projectMetadata.filter(item => !['project-name', 'project-description', 'whitelisted-editors', 'is-creator-added', 'added-by-address', 'is-community-notes', 'tags', 'is-claimed', 'project-wallet'].includes(item.type || '') && !(item.type === 'address' && item.title === 'Creator Wallet')).length > 0;
          
          if (metadataNavigatorHasItems) {
            setIsMetadataNavigatorFocused(true);
          } else {
            // If no metadata items, treat spacebar as down arrow to move to the next item (first review)
            const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
            document.dispatchEvent(event);
          }
        }
      };
      window.addEventListener('keydown', handleSpacebar);
      return () => window.removeEventListener('keydown', handleSpacebar);
    }
  }, [isFocused, isMetadataNavigatorFocused, projectMetadata]);

  // --- Rendering ---

  // Component for the Stats Grid (2 columns on mobile, 2 columns on desktop)
  const StatsGrid = (
    <div className={cn(
      "grid gap-4 text-sm text-muted-foreground",
      "md:grid-cols-2 md:w-full"
    )}>
      <div className={cn(
        "flex flex-col items-center space-y-1",
        isMobile ? "col-span-2" : "col-span-2",
        isMobile && "mb-2"
      )}>
        <TrendingUp className="h-5 w-5 text-hodl-blue" />
        <span className="font-bold font-numeric text-foreground">{stats.interactionScore}</span>
        <span>Interactions</span>
      </div>
      
      <div className={cn(
        "grid gap-4 text-sm text-muted-foreground",
        isMobile ? "grid-cols-2 col-span-2 max-w-xs mx-auto" : "grid-cols-2 col-span-2"
      )}>
        <div className="flex flex-col items-center space-y-4">
          <div className="flex flex-col items-center space-y-1">
            <FileText className="h-5 w-5 text-hodl-purple" />
            <span className="font-bold font-numeric text-foreground">{stats.reviewsCount}</span>
            <span>Reviews</span>
          </div>
          <div className="flex flex-col items-center space-y-1">
            <MessageSquare className="h-5 w-5 text-hodl-purple" />
            <span className="font-bold font-numeric text-foreground">{stats.repliesCount}</span>
            <span>Replies</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center space-y-4">
          <div className="flex flex-col items-center space-y-1">
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

  // Component for the Metadata Section Content (now uses Navigator)
  const MetadataSectionContent = (
    <div className="space-y-4">
      {/* Project Metadata Navigator */}
      <ProjectMetadataNavigator
        projectId={projectId}
        projectMetadata={projectMetadata}
        currentUserProjectHolding={currentUserProjectHolding}
        tokenHoldingsLoading={tokenHoldingsLoading}
        assetUnitName={assetUnitName}
        projectSourceContext={projectSourceContext}
        isParentFocused={isFocused && !isMetadataNavigatorFocused} // Pass parent focus state
        onFocusTransfer={handleFocusTransfer} // Receive internal focus state
        onFocusReturn={handleFocusReturn} // Handle focus return
        setParentFocusedId={setFocusedId} // NEW: Pass setFocusedId
      />
    </div>
  );

  // NEW: Component for Project Notes/Description
  const ProjectNotesContainer = (
    (isLoadingDetails || (currentProjectDescription && currentProjectDescription.trim() !== '')) && (
      <div className="py-4 px-4 bg-gradient-to-r from-notes-gradient-start to-notes-gradient-end text-black rounded-md shadow-recessed">
        <h3 className="text-lg font-semibold mb-2 text-black">
          {isCommunityNotes ? "Community Notes:" : (isCreatorAdded ? "Creator Notes:" : "Contributor Notes:")}
        </h3>
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
    )
  );

  // The Metadata Minicard wrapper (now includes the header content)
  const MetadataMinicard = (
    <div className="w-full md:w-2/3">
      <Card className="bg-card shadow-deep-md">
        <CardHeader className="text-center relative px-4 pt-4 pb-4">
          <CardTitle className="text-4xl font-bold gradient-text">
            {currentProjectName}
          </CardTitle>
          <CardDescription>
            {stats.reviewsCount} {stats.reviewsCount === 1 ? 'review' : 'reviews'} found for this project.
          </CardDescription>
          {currentProjectTags && (
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {currentProjectTags.split(',').map(tag => tag.trim()).filter(Boolean).map((tag, index) => (
                <span key={index} className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {isAuthorizedToClaim && addedByAddress && effectiveCreatorAddress && (
            <div className="mt-2">
              <Button
                onClick={() => setShowThankContributorDialog(true)}
                disabled={isClaiming}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <DollarSign className="h-4 w-4 mr-2" /> Thank Contributor & Claim
              </Button>
            </div>
          )}
          {addedByAddress && (
            <div className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-1">
              Added by <UserDisplay
                address={addedByAddress}
                textSizeClass="text-sm"
                avatarSizeClass="h-6 w-6"
                linkTo={`/profile/${addedByAddress}`}
                sourceContext={projectSourceContext}
              />
            </div>
          )}
          
          {isMobile && (
            <div className="px-2 pt-8">
              {StatsGrid}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 pt-2">
          {MetadataSectionContent}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={cn(
      "w-full",
    )}>
      <Card 
        className={cn(
          "bg-accent mt-8 relative border-2 border-transparent transition-all duration-200",
          isFocused && !isMetadataNavigatorFocused ? "focus-glow-border" : "",
          !isFocused && "hover:focus-glow-border"
        )}
        data-nav-id={project.id} // Register the main card
        onMouseEnter={() => setLastActiveId(project.id)}
        onMouseLeave={() => setLastActiveId(null)}
      >
        {activeAddress && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowProjectDetailsForm(prev => !prev)}
              className="absolute top-2 left-2 z-10 h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Toggle project details form"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        <CardContent className={cn("space-y-4 p-4", isMobile && "p-0")}>
          
          <div className={cn(
            "flex flex-col md:flex-row md:items-stretch",
            "md:space-x-4"
          )}>
            {!isMobile && (
              <div className={cn(
                  "w-full md:w-1/3 flex flex-col md:justify-center",
                  "pb-4 md:pb-0 md:pr-4"
              )}>
                  {StatsGrid}
              </div>
            )}
            
            {MetadataMinicard}
          </div>
          
          {ProjectNotesContainer}

          {activeAddress && showProjectDetailsForm && (
            <ProjectDetailsForm
              projectId={projectId}
              initialProjectMetadata={projectMetadata}
              projectCreatorAddress={effectiveCreatorAddress}
              onProjectDetailsUpdated={handleProjectDetailsUpdated}
            />
          )}
        </CardContent>
      </Card>

      <div className={cn("space-y-6 mt-8", isMobile && "px-2")}>
        <GlassRadioGroup defaultValue="reviews" onValueChange={(value) => setViewMode(value as any)} className="mb-4">
            <GlassRadioItem value="reviews" id="view-reviews" label="Reviews" />
            <GlassRadioItem value="comments" id="view-comments" label="Comments" />
            <GlassRadioItem value="replies" id="view-replies" label="Replies" />
            <GlassRadioItem value="interactions" id="view-interactions" label="Interactions" />
        </GlassRadioGroup>
        {sortedReviews.length > 0 ? (
          sortedReviews.map(({ review, score }) => (
            <ReviewItem
              key={review.id}
              review={review}
              project={project}
              onInteractionSuccess={onInteractionSuccess}
              interactionScore={score}
              writerTokenHoldings={writerTokenHoldings}
              writerHoldingsLoading={writerHoldingsLoading}
              assetUnitName={assetUnitName}
              projectSourceContext={projectSourceContext}
              allCuratorData={allCuratorData}
              focusedId={focusedId}
              registerItem={registerItem}
              isActive={isActive}
              setLastActiveId={setLastActiveId}
              globalViewMode={viewMode} // NEW PROP
            />
          ))
        ) : (
          <p className="text-muted-foreground text-center">No reviews yet for this project.</p>
        )}
        {activeAddress && (
          <NewReviewForExistingProjectForm
            project={project}
            projectsData={projectsData}
            onInteractionSuccess={onInteractionSuccess}
          />
        )}
      </div>

      {isAuthorizedToClaim && addedByAddress && effectiveCreatorAddress && (
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
    </div>
  );
}