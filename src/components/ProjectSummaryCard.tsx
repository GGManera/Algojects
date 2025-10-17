"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Project, Review, Comment } from "@/types/social";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Heart, MessageSquare, TrendingUp, FileText, ChevronRight, Link as LinkIcon, X as XIcon, Gem, UserCircle } from "lucide-react";
import { cn, parseProjectMetadata, formatTimestamp, extractDomainFromUrl, extractXHandleFromUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { UserDisplay } from "./UserDisplay";
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { showError, showSuccess } from "@/utils/toast";
import { MetadataItem } from '@/types/project';
import { CollapsibleContent } from "./CollapsibleContent";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation"; // Import hook type

interface ProjectSummaryCardProps {
  id: string;
  project: Project;
  isExpanded: boolean;
  onToggleExpand: (projectId: string) => void;
  cardRef?: React.Ref<HTMLDivElement>;
  isInsideCarousel?: boolean;
  // NEW: Keyboard navigation props
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean; // NEW PROP
}

interface ProjectStats {
  interactionScore: number;
  reviewsCount: number;
  commentsCount: number;
  repliesCount: number;
  likesCount: number;
}

// Helper function to calculate interaction score for a review (moved here for local use)
const getReviewInteractionScore = (review: Review): number => {
  let score = review.likeCount || 0; // Likes on the review itself
  const comments = Object.values(review.comments || {});
  score += comments.length; // Count of comments on this review

  comments.forEach(comment => {
    score += comment.likeCount || 0; // Likes on this comment
    const replies = Object.values(comment.replies || {});
    score += replies.length; // Count of replies on this comment

    replies.forEach(reply => {
      score += reply.likeCount || 0; // Likes on this reply
    });
  });

  return score;
};

export function ProjectSummaryCard({ project, isExpanded, onToggleExpand, cardRef, isInsideCarousel = false, focusedId, registerItem, isActive }: ProjectSummaryCardProps) {
  const navigate = useNavigate();
  const { pushEntry } = useNavigationHistory();
  const { isMobile } = useAppContextDisplayMode();

  const { projectDetails, loading: detailsLoading, isRefreshing: detailsRefreshing } = useProjectDetails();
  const isLoadingDetails = detailsLoading || detailsRefreshing;

  const [showAssetIdValue, setShowAssetIdValue] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // NEW: Keyboard navigation state
  const isFocused = focusedId === project.id;

  const handleToggleExpand = useCallback(() => {
    onToggleExpand(project.id);
  }, [onToggleExpand, project.id]);

  // Register item for keyboard navigation
  useEffect(() => {
    // Use isActive as a dependency to force re-registration when the slide becomes active
    const cleanup = registerItem(project.id, handleToggleExpand, isExpanded, 'project-summary');
    return cleanup;
  }, [project.id, handleToggleExpand, isExpanded, registerItem, isActive]); // ADDED isActive

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

  const currentProjectDetailsEntry = projectDetails.find(entry => entry.projectId === project.id);
  const projectMetadata: MetadataItem[] = currentProjectDetailsEntry?.projectMetadata || [];

  // Extract "fixed" fields from projectMetadata
  const displayName = projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${project.id}`;
  const projectDescription = projectMetadata.find(item => item.type === 'project-description')?.value;
  const projectTags = projectMetadata.find(item => item.type === 'tags')?.value; // Changed from category to tags
  const isCreatorAdded = projectMetadata.find(item => item.type === 'is-creator-added')?.value === 'true';
  const addedByAddressCoda = projectMetadata.find(item => item.type === 'added-by-address')?.value;
  const isClaimed = projectMetadata.find(item => item.type === 'is-claimed')?.value === 'true'; // NEW: Check if claimed

  // Determine the address that added the project, prioritizing Coda metadata but falling back to on-chain creator wallet
  const addedByAddress = addedByAddressCoda || project.creatorWallet;

  const hasAnyMetadata = projectMetadata.length > 0;

  // Find top and most recent reviews
  const { topReview, mostRecentReview } = useMemo(() => {
    const reviews = Object.values(project.reviews || {});
    if (reviews.length === 0) {
      return { topReview: null, mostRecentReview: null };
    }

    const top = reviews
      .map(review => ({
        review,
        score: getReviewInteractionScore(review),
      }))
      .sort((a, b) => b.score - a.score)[0].review;

    const recent = reviews.sort((a, b) => b.timestamp - a.timestamp)[0];

    return { topReview: top, mostRecentReview: recent };
  }, [project.reviews]);

  const displayReviews = useMemo(() => {
    const reviewsToShow: { review: Review; label: string; score: number }[] = [];
    if (!topReview) {
      return [];
    }

    const isSameReview = topReview.id === mostRecentReview?.id;

    if (isSameReview) {
      reviewsToShow.push({ review: topReview, label: "Top & Most Recent Review", score: getReviewInteractionScore(topReview) });
    } else {
      reviewsToShow.push({ review: topReview, label: "Top Review", score: getReviewInteractionScore(topReview) });
      if (mostRecentReview) {
        reviewsToShow.push({ review: mostRecentReview, label: "Most Recent Review", score: getReviewInteractionScore(mostRecentReview) });
      }
    }
    return reviewsToShow;
  }, [topReview, mostRecentReview]);


  const handleGoToProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/project/${project.id}`);
  };

  // Define the source context for UserDisplay components within this card
  const projectSourceContext = useMemo(() => ({
    path: `/project/${project.id}`,
    label: displayName,
  }), [project.id, displayName]);

  const handleAssetIdClick = async (e: React.MouseEvent, assetIdValue: string) => {
    e.stopPropagation();

    if (isMobile) {
      if (showAssetIdValue) {
        if (assetIdValue) {
          try {
            await navigator.clipboard.writeText(assetIdValue);
            setCopiedMessage("Copied!");
            setTimeout(() => {
              setCopiedMessage(null);
              setShowAssetIdValue(false);
            }, 2000);
          } catch (err) {
            showError("Failed to copy Asset ID.");
          }
        }
      } else {
        setShowAssetIdValue(true);
        setTimeout(() => {
          if (!copiedMessage) setShowAssetIdValue(false);
        }, 3000);
      }
    } else {
      if (assetIdValue) {
        try {
          await navigator.clipboard.writeText(assetIdValue);
          setCopiedMessage("Copied!");
          setTimeout(() => setCopiedMessage(null), 2000);
        } catch (err) {
          showError("Failed to copy Asset ID.");
        }
      }
    }
  };

  // Modified to accept defaultTitle and prioritize dynamic states
  const displayAssetIdText = (assetIdValue: string, defaultTitle: string | undefined) => {
    if (copiedMessage) return copiedMessage;
    if (isMobile) {
      return showAssetIdValue ? assetIdValue : (defaultTitle || "Asset ID");
    }
    return isHovered ? assetIdValue : (defaultTitle || "Asset ID");
  };

  const renderMetadataItem = (item: MetadataItem, index: number) => {
    // Base classes for centering and max width
    const baseItemClasses = "w-full max-w-[180px] mx-auto";

    // Skip rendering of "fixed" metadata items here
    if (['project-name', 'project-description', 'whitelisted-editors', 'is-creator-added', 'added-by-address', 'is-community-notes', 'tags', 'is-claimed', 'project-wallet'].includes(item.type || '') || (item.type === 'address' && item.title === 'Creator Wallet')) {
      return null;
    }

    if (item.type === 'url' || (item.value.startsWith('http') && !item.value.includes('x.com') && !item.value.includes('twitter.com'))) {
      return (
        <div
          key={index}
          className={cn("btn-profile", baseItemClasses)}
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
          className={cn("btn-profile", baseItemClasses)}
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
          className={cn("btn-profile", baseItemClasses)}
          onClick={(e) => handleAssetIdClick(e, item.value)}
          onMouseEnter={() => !isMobile && setIsHovered(true)}
          onMouseLeave={() => !isMobile && setIsHovered(false)}
        >
          <strong className="uppercase">{displayAssetIdText(item.value, item.title)}</strong>
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
        <div key={index} className={cn("inline-flex flex-col p-2 rounded-md bg-background/50 border border-border text-center", baseItemClasses)}>
          <span className="font-semibold text-muted-foreground text-xs">{item.title || 'Address'}:</span>
          <UserDisplay address={item.value} textSizeClass="text-xs" avatarSizeClass="h-5 w-5" linkTo={`/profile/${item.value}`} sourceContext={projectSourceContext} className="justify-center" />
        </div>
      );
    } else {
      return (
        <div key={index} className={cn("inline-flex flex-col p-2 rounded-md bg-background/50 border border-border text-center", baseItemClasses)}>
          <span className="font-semibold text-muted-foreground text-xs">{item.title}:</span>
          <p className="text-sm text-foreground selectable-text">{item.value}</p>
        </div>
      );
    }
  };

  return (
    <motion.div
      ref={cardRef}
      layout
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "w-full cursor-pointer transition-all duration-300 ease-in-out",
        isExpanded ? "shadow-lg" : "",
        "flex flex-col",
        "scroll-mt-header-offset",
        !isInsideCarousel && "max-w-3xl",
        isFocused ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "" // Apply focus highlight
      )}
      onClick={() => onToggleExpand(project.id)}
      data-nav-id={project.id} // Add data attribute for keyboard navigation
    >
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          {isLoadingDetails ? (
            <Skeleton className="h-7 w-3/5" />
          ) : (
            <CardTitle className="pb-1 flex-grow text-center">
              <Link
                to={`/project/${project.id}`}
                onClick={handleGoToProject}
                className="gradient-text hover:underline"
              >
                {displayName}
              </Link>
            </CardTitle>
          )}
          <div className="ml-auto w-6 h-6 flex items-center justify-center">
            {isExpanded && (
              <Button variant="ghost" size="icon" onClick={handleGoToProject} className="h-6 w-6">
                <ChevronRight className="h-6 w-6 text-primary" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm text-muted-foreground">
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

          <CollapsibleContent isOpen={isExpanded}>
            <div className="mt-4 space-y-4">
              {/* Project Notes/Description */}
              {(isLoadingDetails || (projectDescription && projectDescription.trim() !== '')) && (
                <div className="py-3 px-3 bg-gradient-to-r from-notes-gradient-start to-notes-gradient-end text-black rounded-md shadow-recessed">
                  <h3 className="text-md font-semibold mb-2 text-black">Notes:</h3>
                  {isLoadingDetails ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <p className="text-black/90 whitespace-pre-wrap text-sm">{projectDescription}</p>
                  )}
                </div>
              )}

              {/* Project Tags */}
              {projectTags && (
                <div className="py-3 px-3 bg-muted/50 text-foreground rounded-md shadow-recessed">
                  <h3 className="text-md font-semibold mb-2">Tags:</h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {projectTags.split(',').map(tag => tag.trim()).filter(Boolean).map((tag, index) => (
                      <span key={index} className="px-2 py-1 rounded-full bg-primary/20 text-primary-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Added By Address */}
              {addedByAddress && (
                <div className="py-3 px-3 bg-muted/50 text-foreground rounded-md shadow-recessed flex items-center justify-between">
                  <h3 className="text-md font-semibold">Added By:</h3>
                  <UserDisplay 
                    address={addedByAddress} 
                    textSizeClass="text-sm" 
                    avatarSizeClass="h-6 w-6" 
                    linkTo={`/profile/${addedByAddress}`} 
                    sourceContext={projectSourceContext} 
                  />
                </div>
              )}

              {/* Project Metadata - Enforcing 2 columns */}
              {hasAnyMetadata && (
                <div className="py-4 px-3 bg-muted/50 text-foreground rounded-md shadow-recessed">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    {projectMetadata.map((item, index) => renderMetadataItem(item, index))}
                  </div>
                </div>
              )}

              {/* Featured Reviews */}
              <div className="space-y-3">
                <h3 className="text-md font-semibold gradient-text">Featured Reviews:</h3>
                {displayReviews.length > 0 ? (
                  displayReviews.map(({ review: r, label, score }) => (
                    <div key={`${r.id}-${label}`}>
                      <p className="text-xs font-bold text-white/80 mb-1 ml-1">{label}</p>
                      <Link
                        to={`/project/${project.id}#review-${r.id.split('.')[1]}`}
                        className="block p-2 bg-gradient-to-r from-gradient-start/70 to-gradient-end/70 rounded-md hover:opacity-90 transition-opacity text-white text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <UserDisplay address={r.sender} textSizeClass="text-sm" avatarSizeClass="h-7 w-7" sourceContext={projectSourceContext} linkTo={null} />
                          <span className="text-xs text-white/70">{formatTimestamp(r.timestamp)}</span>
                        </div>
                        <p className="whitespace-pre-wrap line-clamp-2">{r.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-white/80">
                          <TrendingUp className="h-3 w-3" /> {score}
                          <Heart className="h-3 w-3 ml-2" /> {r.likeCount || 0}
                          <MessageCircle className="h-3 w-3 ml-2" /> {Object.keys(r.comments || {}).length}
                        </div>
                      </Link>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No reviews yet.</p>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </motion.div>
  );
}