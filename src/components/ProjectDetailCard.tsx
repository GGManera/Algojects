"use client";

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
import { AlertTriangle, Link as LinkIcon, Copy, Gem, UserCircle, X, Edit, Heart, MessageCircle, MessageSquare, FileText, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { UserDisplay } from "./UserDisplay";
import { Button } from "@/components/ui/button";
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
import { useNfdAddressResolver } from "@/hooks/useNfdAddressResolver";

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

interface ProjectDetailCardProps {
  project: Project;
  projectsData: ProjectsData;
  activeAddress: string | undefined;
  onInteractionSuccess: () => void;
  currentProjectName: string;
  isInsideCarousel?: boolean;
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

export function ProjectDetailCard({ project, projectsData, activeAddress, onInteractionSuccess, isInsideCarousel = false }: ProjectDetailCardProps) {
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
  const currentWhitelistedAddresses = projectMetadata.find(item => item.type === 'whitelisted-editors')?.value?.split(',').map(addr => addr.trim()).filter(Boolean) || [];
  const isCreatorAdded = projectMetadata.find(item => item.type === 'is-creator-added')?.value === 'true';
  const addedByAddressCoda = projectMetadata.find(item => item.type === 'added-by-address')?.value;
  const isCommunityNotes = projectMetadata.find(item => item.type === 'is-community-notes')?.value === 'true';
  const isClaimed = projectMetadata.find(item => item.type === 'is-claimed')?.value === 'true';
  
  // Get Creator Wallet metadata item
  const creatorWalletItem = projectMetadata.find(item => item.title === 'Creator Wallet');
  const creatorWalletMetadata = creatorWalletItem?.value;

  // Determine the address that added the project, prioritizing Coda metadata but falling back to on-chain creator wallet
  const addedByAddress = addedByAddressCoda || project.creatorWallet;

  // NEW: Resolve the Creator Wallet metadata value (which might be an NFD)
  const { resolvedAddress: resolvedCreatorAddress, loading: resolvingCreatorAddress } = useNfdAddressResolver(creatorWalletMetadata);

  // Determine the address that should claim the project (resolved Creator Wallet metadata or the first review sender)
  const effectiveCreatorAddress = resolvedCreatorAddress || creatorWalletMetadata || project.creatorWallet;
  
  // The button should appear if:
  // 1. Wallet is connected (activeAddress)
  // 2. The project is not yet claimed (isClaimed === false)
  // 3. The connected user is the effective creator (activeAddress === effectiveCreatorAddress)
  // 4. The project was added by a different address (addedByAddress exists and addedByAddress !== effectiveCreatorAddress)
  const isAuthorizedToClaim = activeAddress && effectiveCreatorAddress && activeAddress === effectiveCreatorAddress && !isClaimed && addedByAddress && activeAddress !== addedByAddress;

  const handleProjectDetailsUpdated = () => {
    refetchProjectDetails();
    onInteractionSuccess();
  };

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

  // Extract specific metadata items for special rendering
  const urlItem = projectMetadata.find(item => item.type === 'url' || (item.value.startsWith('http') && !item.value.includes('x.com') && !item.value.includes('twitter.com')));
  const xUrlItem = projectMetadata.find(item => item.type === 'x-url' || item.value.includes('x.com') || item.value.includes('twitter.com'));
  const assetIdItem = projectMetadata.find(item => item.type === 'asset-id' || (!isNaN(parseInt(item.value)) && parseInt(item.value) > 0));

  const hasAnyMetadata = projectMetadata.length > 0;

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

  const handleAssetIdClick = async (e: React.MouseEvent, assetIdValue: string) => {
    e.stopPropagation();

    if (isMobile) {
      if (showAssetIdValue) {
        if (assetIdValue) {
          try {
            await navigator.clipboard.writeText(assetIdValue);
            setCopiedAssetIdMessage("Copied!");
            setTimeout(() => {
              setCopiedAssetIdMessage(null);
              setShowAssetIdValue(false);
            }, 2000);
          } catch (err) {
            showError("Failed to copy Asset ID.");
          }
        }
      } else {
        setShowAssetIdValue(true);
        setTimeout(() => {
          if (!copiedAssetIdMessage) setShowAssetIdValue(false);
        }, 3000);
      }
    } else {
      if (assetIdValue) {
        try {
          await navigator.clipboard.writeText(assetIdValue);
          setCopiedAssetIdMessage("Copied!");
          setTimeout(() => setCopiedAssetIdMessage(null), 2000);
        } catch (err) {
          showError("Failed to copy Asset ID.");
        }
      }
    }
  };

  // Modified to accept defaultTitle and prioritize dynamic states
  const getDisplayAssetIdText = useCallback((assetIdValue: string, defaultTitle: string | undefined) => {
    if (copiedAssetIdMessage) return copiedAssetIdMessage;
    if (isMobile) {
      return showAssetIdValue ? assetIdValue : (defaultTitle || "Asset ID");
    }
    return isAssetIdHovered ? assetIdValue : (defaultTitle || "Asset ID");
  }, [copiedAssetIdMessage, isMobile, showAssetIdValue, isAssetIdHovered]);

  return (
    <div className={cn(
      "w-full",
      // Removed: !isInsideCarousel && "mx-auto min-w-sm"
    )}>
      <Card className="bg-accent mt-8">
        <CardHeader className="text-center relative">
          {activeAddress && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowProjectDetailsForm(prev => !prev)}
              className="absolute top-2 left-2 h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Toggle project details form"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          <CardTitle className="text-4xl font-bold gradient-text">
            {currentProjectName}
          </CardTitle>
          <CardDescription>
            {sortedReviews.length} review(s) found for this project.
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
          {/* NEW: Thank Contributor Button */}
          {isAuthorizedToClaim && addedByAddress && effectiveCreatorAddress && (
            <div className="mt-4">
              <Button
                onClick={() => setShowThankContributorDialog(true)}
                disabled={isClaiming || resolvingCreatorAddress}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <DollarSign className="h-4 w-4 mr-2" /> Thank Contributor & Claim
              </Button>
            </div>
          )}
          {/* END NEW */}
          {/* Display Added By Address */}
          {addedByAddress && (
            <div className="mt-2 text-sm text-muted-foreground flex items-center justify-center gap-1">
              Added by <UserDisplay
                address={addedByAddress}
                textSizeClass="text-sm"
                avatarSizeClass="h-6 w-6"
                linkTo={`/profile/${addedByAddress}`}
                sourceContext={projectSourceContext}
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {/* Project Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm text-muted-foreground border-b border-border pb-4">
            <div className="flex flex-col items-center space-y-1">
              <TrendingUp className="h-5 w-5 text-hodl-blue" />
              <span className="font-bold font-numeric text-foreground">{stats.interactionScore}</span>
              <span>Interactions</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <FileText className="h-5 w-5 text-hodl-purple" />
              <span className="font-bold font-numeric text-foreground">{stats.reviewsCount}</span>
              <span>Reviews</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <MessageCircle className="h-5 w-5 text-hodl-purple" />
              <span className="font-bold font-numeric text-foreground">{stats.commentsCount}</span>
              <span>Comments</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <MessageSquare className="h-5 w-5 text-hodl-purple" />
              <span className="font-bold font-numeric text-foreground">{stats.repliesCount}</span>
              <span>Replies</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <Heart className="h-5 w-5 text-pink-400" />
              <span className="font-bold font-numeric text-foreground">{stats.likesCount}</span>
              <span>Likes</span>
            </div>
          </div>
          
          {/* Project Description/Notes */}
          {(isLoadingDetails || (currentProjectDescription && currentProjectDescription.trim() !== '')) && (
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
          )}

          {/* Project Metadata */}
          {hasAnyMetadata && (
            <div className="py-6 px-4 bg-muted/50 text-foreground rounded-md shadow-recessed">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {/* Explicitly render Creator Wallet here, showing only the resolved address/raw input */}
                {creatorWalletItem && (
                    <div className="flex flex-col p-2 rounded-md bg-background/50 border border-border">
                        <span className="font-semibold text-muted-foreground text-xs">{creatorWalletItem.title}:</span>
                        {resolvingCreatorAddress ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-hodl-blue" />
                                <span className="text-sm text-muted-foreground">Resolving...</span>
                            </div>
                        ) : (
                            <p className="text-sm text-foreground selectable-text break-all">
                                {resolvedCreatorAddress || creatorWalletMetadata || 'N/A'}
                            </p>
                        )}
                    </div>
                )}
                {projectMetadata.map((item, index) => {
                  // Skip rendering of "fixed" metadata items here, including Creator Wallet
                  if (['project-name', 'project-description', 'whitelisted-editors', 'is-creator-added', 'added-by-address', 'is-community-notes', 'tags', 'is-claimed', 'Creator Wallet'].includes(item.title || '')) {
                    return null;
                  }

                  if (item.type === 'url' || (item.value.startsWith('http') && !item.value.includes('x.com') && !item.value.includes('twitter.com'))) {
                    return (
                      <div
                        key={index}
                        className="btn-profile mx-auto"
                        onClick={(e) => { e.stopPropagation(); window.open(item.value, '_blank'); }}
                      >
                        <strong className="uppercase">{item.title || extractDomainFromUrl(item.value)}</strong>
                        <div id="container-stars">
                          <div id="stars"></div>
                        </div>
                        <div id="glow">
                          <div className="circle"></div>
                          <div className="circle"></div>
                        </div>
                      </div>
                    );
                  } else if (item.type === 'x-url' || item.value.includes('x.com') || item.value.includes('twitter.com')) {
                    return (
                      <div
                        key={index}
                        className="btn-profile mx-auto"
                        onClick={(e) => { e.stopPropagation(); window.open(item.value, '_blank'); }}
                      >
                        <strong className="uppercase">{item.title || extractXHandleFromUrl(item.value)}</strong>
                        <div id="container-stars">
                          <div id="stars"></div>
                        </div>
                        <div id="glow">
                          <div className="circle"></div>
                          <div className="circle"></div>
                        </div>
                      </div>
                    );
                  } else if (item.type === 'asset-id' || (!isNaN(parseInt(item.value)) && parseInt(item.value) > 0)) {
                    return (
                      <div
                        key={index}
                        className="btn-profile mx-auto"
                        onClick={(e) => handleAssetIdClick(e, item.value)}
                        onMouseEnter={() => !isMobile && setIsAssetIdHovered(true)}
                        onMouseLeave={() => !isMobile && setIsAssetIdHovered(false)}
                      >
                        <strong className="uppercase">{getDisplayAssetIdText(item.value, item.title)}</strong>
                        <div id="container-stars">
                          <div id="stars"></div>
                        </div>
                        <div id="glow">
                          <div className="circle"></div>
                          <div className="circle"></div>
                        </div>
                      </div>
                    );
                  } else if (item.type === 'address' || item.value.length === 58) {
                    return (
                      <div key={index} className="flex flex-col p-2 rounded-md bg-background/50 border border-border">
                        <span className="font-semibold text-muted-foreground text-xs">{item.title || 'Address'}:</span>
                        <UserDisplay
                          address={item.value}
                          textSizeClass="text-sm"
                          avatarSizeClass="h-5 w-5"
                          linkTo={`/profile/${item.value}`}
                          sourceContext={projectSourceContext}
                        />
                      </div>
                    );
                  } else {
                    return (
                      <div key={index} className="flex flex-col p-2 rounded-md bg-background/50 border border-border">
                        <span className="font-semibold text-muted-foreground text-xs">{item.title}:</span>
                        <p className="text-sm text-foreground selectable-text">{item.value}</p>
                      </div>
                    );
                  }
                })}
                {currentUserProjectHolding && (
                  <div className="flex flex-col p-2 rounded-md bg-background/50 border border-border">
                    <span className="font-semibold text-muted-foreground text-xs">Your Holding:</span>
                    {tokenHoldingsLoading || assetUnitNameLoading ? (
                      <Skeleton className="h-4 w-20" />
                    ) : currentUserProjectHolding ? (
                      <div className="flex items-center gap-1">
                        <Gem className="h-4 w-4 text-hodl-blue" />
                        <span className="font-numeric font-bold text-primary selectable-text">
                          {currentUserProjectHolding.amount} {assetUnitName || ''}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground selectable-text">0 (Not held)</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Project Details Form is now conditionally rendered here */}
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

      <div className="space-y-6 mt-8">
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

      {/* NEW: Thank Contributor Dialog */}
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