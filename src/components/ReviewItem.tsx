"use client";

import { Review, Project, Comment } from "@/types/social";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { UserDisplay } from "./UserDisplay";
import { LikeButton } from "./LikeButton";
import { CommentItem } from "./CommentItem";
import { formatTimestamp, getCuratorWeightedLikeScore } from "@/lib/utils";
import { MessageCircle, Info, Star, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import { AllCuratorCalculationsMap } from "@/hooks/useCuratorIndex";
import { InteractionDetailsPanel } from "./InteractionDetailsPanel";
import { CollapsibleContent } from "./CollapsibleContent";
import { cn } from "@/lib/utils";
import { InteractionActionsMenu } from "./InteractionActionsMenu";
import { InteractionForm } from "./InteractionForm";
import { useWallet } from "@txnlab/use-wallet-react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // NEW Import

interface ReviewItemProps {
  review: Review;
  project: Project;
  onInteractionSuccess: () => void;
  interactionScore: number;
  projectSourceContext: { path: string; label: string };
  allCuratorData: AllCuratorCalculationsMap;
  // NEW: Keyboard navigation props
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean; // NEW PROP
  setLastActiveId: ReturnType<typeof useKeyboardNavigation>['setLastActiveId']; // NEW PROP
  globalViewMode: 'reviews' | 'comments' | 'replies' | 'interactions'; // NEW PROP
}

export function ReviewItem({
  review,
  project,
  onInteractionSuccess,
  interactionScore,
  projectSourceContext,
  allCuratorData,
  focusedId,
  registerItem,
  isActive,
  setLastActiveId,
  globalViewMode,
}: ReviewItemProps) {
  const [areCommentsVisible, setAreCommentsVisible] = useState(false);
  const [hasUserClicked, setHasUserClicked] = useState(false); // NEW: Track if user has clicked
  const [showInteractionDetails, setShowInteractionDetails] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { activeAddress } = useWallet();
  const { isMobile } = useAppContextDisplayMode(); // NEW Hook call

  const isExcluded = review.isExcluded;

  // NEW: 1. Calculate forced expansion state for comments
  const commentsCount = Object.keys(review.comments || {}).length;
  const forcedCommentsState = useMemo(() => {
    switch (globalViewMode) {
      case 'reviews':
        return false; // Collapse comments
      case 'comments':
      case 'replies':
      case 'interactions':
        // Expand only if review has comments
        return commentsCount > 0;
      default:
        return false;
    }
  }, [globalViewMode, commentsCount]);

  // NEW: 2. Synchronize local state with forced state when global mode changes
  useEffect(() => {
    if (areCommentsVisible !== forcedCommentsState) {
        setAreCommentsVisible(forcedCommentsState);
    }
  }, [globalViewMode, forcedCommentsState]);

  // NEW: 3. Use local state for rendering visibility
  const isCommentsVisible = areCommentsVisible;

  // NEW: Keyboard navigation state
  const isFocused = focusedId === review.id;

  // NEW: Check if the review is excluded AND the current user is NOT the sender
  const isHidden = isExcluded && activeAddress !== review.sender;

  const handleToggleExpand = useCallback(() => {
    setAreCommentsVisible(prev => !prev);
    setShowCommentForm(false); // Collapse form when collapsing review
  }, []);

  // Register item for keyboard navigation
  useEffect(() => {
    // Use isActive as a dependency to force re-registration when the slide becomes active
    const cleanup = registerItem(review.id, handleToggleExpand, isCommentsVisible, 'review');
    return cleanup;
  }, [review.id, handleToggleExpand, isCommentsVisible, registerItem, isActive]); // Use isCommentsVisible here

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAreCommentsVisible(true);
    setShowCommentForm(prev => !prev);
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    if (isExcluded) return; // Prevent interaction if excluded
    // NEW: Set clicked state and toggle expansion
    setHasUserClicked(true);
    handleToggleExpand();
    setShowInteractionDetails(false);
  };

  // UPDATED: Sticky Hover Logic
  const handleMouseEnter = useCallback(() => {
    setLastActiveId(review.id);
    // Only expand on hover if the user hasn't clicked yet AND there are comments
    if (!hasUserClicked && !areCommentsVisible && commentsCount > 0) { 
        setAreCommentsVisible(true);
    }
  }, [review.id, setLastActiveId, areCommentsVisible, commentsCount, hasUserClicked]);

  const handleMouseLeave = useCallback(() => {
    setLastActiveId(null);
    // No action here, the expansion is sticky until clicked again
  }, [setLastActiveId]);

  const curatorWeightedLikeScore = useMemo(() => {
    return getCuratorWeightedLikeScore(review, allCuratorData);
  }, [review, allCuratorData]);

  if (isHidden) {
    return null;
  }

  return (
    <div ref={ref} id={`review-${review.id.split('.')[1]}`} className="scroll-mt-header-offset">
      <div
        className={cn(
          "block w-full rounded-lg shadow-none overflow-hidden transition-all duration-300 cursor-pointer", // Removed border-2 border-transparent
          "rounded-lg",
          isFocused ? "focus-glow-border" : "", // Apply keyboard focus highlight
          !isFocused && !isMobile && "hover:focus-glow-border", // Apply hover focus highlight only if NOT focused AND NOT mobile
          isExcluded
            ? "bg-muted/30 border border-destructive/50 pointer-events-none" // Muted style for excluded
            : "bg-gradient-to-r from-gradient-start to-gradient-end text-white" // Normal style
        )}
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter} // UPDATED
        onMouseLeave={handleMouseLeave} // UPDATED
        data-nav-id={review.id} // Add data attribute for keyboard navigation
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <UserDisplay
              address={review.sender}
              textSizeClass="text-lg"
              avatarSizeClass="h-10 w-10"
              projectSourceContext={projectSourceContext}
            />
            <div className="flex items-center space-x-2">
              <span className={cn("text-xs font-semibold", isExcluded ? "text-muted-foreground" : "text-white/70")}>{formatTimestamp(review.timestamp)}</span>
              <InteractionActionsMenu
                item={review}
                project={project}
                onInteractionSuccess={onInteractionSuccess}
              />
            </div>
          </div>
          {isExcluded ? (
            <p className="font-bold text-destructive/80 text-xl text-center py-4">[EXCLUDED]</p>
          ) : (
            <p className="whitespace-pre-wrap font-semibold selectable-text">{review.content}</p>
          )}
        </div>

        {!isExcluded && (
          <div className="flex justify-around items-center p-2 text-white/70 border-t border-white/20">
            <LikeButton
              item={review}
              project={project}
              onInteractionSuccess={onInteractionSuccess}
              className="hover:text-pink-400"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCommentClick}
              className="flex items-center space-x-2 hover:text-white transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="font-numeric">{commentsCount}</span>
            </Button>
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="font-numeric">{curatorWeightedLikeScore.toFixed(1)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setShowInteractionDetails(prev => !prev); }}
              className="flex items-center space-x-2 hover:text-white transition-colors"
            >
              <Info className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Hide details panel and comment form if excluded */}
      {!isExcluded && (
        <>
          <CollapsibleContent isOpen={showInteractionDetails}>
            <InteractionDetailsPanel
              item={review}
              project={project}
              onInteractionSuccess={onInteractionSuccess}
            />
          </CollapsibleContent>

          <CollapsibleContent isOpen={isCommentsVisible} className="pl-4 space-y-4">
            {Object.values(review.comments)
              .sort((a, b) => a.timestamp - b.timestamp)
              .filter(comment => !comment.isExcluded || activeAddress === comment.sender) // Filter excluded comments
              .map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  project={project}
                  review={review}
                  onInteractionSuccess={onInteractionSuccess}
                  projectSourceContext={projectSourceContext}
                  allCuratorData={allCuratorData}
                  // NEW: Pass keyboard navigation props
                  focusedId={focusedId}
                  registerItem={registerItem}
                  isActive={isActive} // NEW
                  setLastActiveId={setLastActiveId} // NEW
                  globalViewMode={globalViewMode} // NEW
                />
              ))}
            {showCommentForm && (
              <InteractionForm
                type="comment"
                project={project}
                review={review}
                onInteractionSuccess={() => {
                  onInteractionSuccess();
                  setShowCommentForm(false);
                }}
              />
            )}
          </CollapsibleContent>
        </>
      )}
    </div>
  );
}