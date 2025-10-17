"use client";

import { Review, Project, Comment } from "@/types/social";
import { CommentItem } from "./CommentItem";
import { LikeButton } from "./LikeButton";
import { InteractionForm } from "./InteractionForm";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { UserDisplay } from "./UserDisplay";
import { TrendingUp, Share2, MessageCircle, Gem, Star } from "lucide-react";
import { formatTimestamp, getCuratorWeightedLikeScore } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { showError } from "@/utils/toast";
import { motion, AnimatePresence } from "framer-motion";
import { InteractionDetailsPanel } from "./InteractionDetailsPanel";
import { useWallet } from "@txnlab/use-wallet-react";
import { AllCuratorCalculationsMap } from '@/hooks/useCuratorIndex';
import { CollapsibleContent } from "./CollapsibleContent";
import { InteractionActionsMenu } from "./InteractionActionsMenu"; // NEW Import
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation"; // Import hook type
import { cn } from "@/lib/utils";

interface ReviewItemProps {
  review: Review;
  project: Project;
  onInteractionSuccess: () => void;
  interactionScore: number;
  writerTokenHoldings: Map<string, number>;
  writerHoldingsLoading: boolean;
  assetUnitName: string | null;
  projectSourceContext: { path: string; label: string };
  allCuratorData: AllCuratorCalculationsMap;
  // NEW: Keyboard navigation props
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean; // NEW PROP
  setLastActiveId: ReturnType<typeof useKeyboardNavigation>['setLastActiveId']; // NEW PROP
}

const CONTENT_TRUNCATE_LENGTH = 280;

const getCommentInteractionScore = (comment: Comment): number => {
  let score = comment.likeCount || 0;
  const replies = Object.values(comment.replies || {});
  score += replies.length;
  replies.forEach(reply => {
    score += reply.likeCount || 0;
  });
  return score;
};

export function ReviewItem({ review, project, onInteractionSuccess, interactionScore, writerTokenHoldings, writerHoldingsLoading, assetUnitName, projectSourceContext, allCuratorData, focusedId, registerItem, isActive, setLastActiveId }: ReviewItemProps) {
  const location = useLocation();
  const { expandCommentId, highlightReplyId, highlightCommentId } = (location.state as { expandCommentId?: string; highlightReplyId?: string; highlightCommentId?: string; }) || {};
  const { activeAddress } = useWallet(); // Get active address

  const containsTargetComment = useMemo(() => {
    if (!expandCommentId || !review.comments) return false;
    return expandCommentId.startsWith(review.id + '.');
  }, [expandCommentId, review.id]);

  const [isExpanded, setIsExpanded] = useState(containsTargetComment);
  const [showAllComments, setShowAllComments] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [showInteractionDetails, setShowInteractionDetails] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const navigate = useNavigate();

  // NEW: Keyboard navigation state
  const isFocused = focusedId === review.id;

  // NEW: Check if the review is excluded AND the current user is NOT the sender
  const isHidden = review.isExcluded && activeAddress !== review.sender;

  useEffect(() => {
    if (containsTargetComment) {
      setIsExpanded(true);
    }
  }, [containsTargetComment]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
    setShowCommentForm(false); // Collapse form when collapsing review
  }, []);

  // Register item for keyboard navigation
  useEffect(() => {
    // Use isActive as a dependency to force re-registration when the slide becomes active
    const cleanup = registerItem(review.id, handleToggleExpand, isExpanded, 'review');
    return cleanup;
  }, [review.id, handleToggleExpand, isExpanded, registerItem, isActive]); // ADDED isActive

  const sortedComments = useMemo(() => {
    const allComments = Object.values(review.comments || {});
    // Filter out excluded comments unless the current user is the sender
    return allComments
      .filter(comment => !comment.isExcluded || activeAddress === comment.sender)
      .map(comment => ({
        comment,
        score: getCommentInteractionScore(comment),
      }))
      .sort((a, b) => b.score - a.score);
  }, [review.comments, activeAddress]);

  const commentsToShow = showAllComments ? sortedComments : sortedComments.slice(0, 3);
  const hasComments = sortedComments.length > 0;

  const isLongReview = review.content.length > CONTENT_TRUNCATE_LENGTH;
  const displayContent = isLongReview && !isExpanded
    ? `${review.content.substring(0, CONTENT_TRUNCATE_LENGTH)}...`
    : review.content;

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    handleToggleExpand();
    setShowInteractionDetails(false);
  };

  const handleShare = async () => {
    const reviewIdLocal = review.id.split('.')[1];
    const urlToCopy = `${window.location.origin}/project/${project.id}#review-${reviewIdLocal}`;
    
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
      showError("Failed to copy link.");
    }
  };

  const curatorWeightedLikeScore = useMemo(() => {
    return getCuratorWeightedLikeScore(review, allCuratorData);
  }, [review, allCuratorData]);

  if (isHidden) {
    return null;
  }

  return (
    <div 
      id={`review-${review.id.split('.')[1]}`}
      className="scroll-mt-header-offset mb-4"
    >
      <div 
        className={cn(
          "w-full bg-gradient-to-r from-gradient-start to-gradient-end text-white rounded-lg overflow-hidden cursor-pointer transition-all duration-200 border-2 border-transparent", // Added transparent border base
          "rounded-lg", // ADDED rounded-lg here
          isFocused ? "focus-glow-border" : "", // Apply keyboard focus highlight
          // REMOVED: !isFocused && "hover:focus-glow-border" // Apply hover focus highlight only if not already focused
        )}
        onClick={handleCardClick}
        onMouseEnter={() => setLastActiveId(review.id)} // NEW: Set active ID on mouse enter
        onMouseLeave={() => setLastActiveId(null)} // NEW: Clear active ID on mouse leave
        data-nav-id={review.id} // Add data attribute for keyboard navigation
      >
        <div className="flex items-start justify-between p-2">
          <UserDisplay 
            address={review.sender} 
            textSizeClass="text-base" 
            avatarSizeClass="h-10 w-10" 
            projectTokenHoldings={writerTokenHoldings}
            assetUnitName={assetUnitName}
            projectSourceContext={projectSourceContext}
          />
          <div className="flex items-center space-x-2">
            <span className="text-xs text-white/70 font-semibold">{formatTimestamp(review.timestamp)}</span>
            <InteractionActionsMenu 
              item={review} 
              project={project} 
              onInteractionSuccess={onInteractionSuccess} 
            />
          </div>
        </div>

        <div className="px-3 pb-2">
          <p className="whitespace-pre-wrap font-semibold selectable-text">{displayContent}</p>
          {isLongReview && !isExpanded && (
            <span className="text-blue-200 font-bold mt-2 inline-block">
              Continue reading
            </span>
          )}
        </div>

        <div className="flex justify-around items-center p-2 text-white/70 border-t border-white/20">
          <button 
            className="flex items-center space-x-2 hover:text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowInteractionDetails(prev => !prev); }}
          >
            <TrendingUp className="h-5 w-5" />
            <span className="font-numeric">{interactionScore}</span>
          </button>
          <div className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-yellow-400" />
            <span className="font-numeric">{curatorWeightedLikeScore.toFixed(1)}</span>
          </div>
          <button 
            className="flex items-center space-x-2 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              if (!isExpanded) setIsExpanded(true);
              setShowCommentForm(prev => !prev);
            }}
          >
            <MessageCircle className="h-5 w-5" />
            <span className="font-numeric">{sortedComments.length}</span>
          </button>
          <LikeButton
            item={review}
            project={project}
            onInteractionSuccess={onInteractionSuccess}
            className="hover:text-pink-200"
          />
          <button onClick={handleShare} className="flex items-center space-x-2 hover:text-white transition-colors w-20 justify-center">
            <AnimatePresence mode="wait">
              {showCopied ? (
                <motion.span
                  key="copied-text"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm font-semibold"
                >
                  Copied!
                </motion.span>
              ) : (
                <motion.div
                  key="share-icon"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center space-x-2"
                >
                  <Share2 className="h-5 w-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>

      <CollapsibleContent isOpen={showInteractionDetails}>
        <InteractionDetailsPanel
          item={review}
          project={project}
          onInteractionSuccess={onInteractionSuccess}
        />
      </CollapsibleContent>

      <CollapsibleContent isOpen={isExpanded} className="px-4">
        {hasComments ? (
          <div className="space-y-4">
            {commentsToShow.map(({ comment }) => (
              <CommentItem 
                key={comment.id} 
                comment={comment} 
                review={review} 
                project={project} 
                onInteractionSuccess={onInteractionSuccess} 
                writerTokenHoldings={writerTokenHoldings}
                writerHoldingsLoading={writerHoldingsLoading}
                assetUnitName={assetUnitName}
                projectSourceContext={projectSourceContext}
                allCuratorData={allCuratorData}
                expandCommentId={expandCommentId}
                highlightReplyId={highlightReplyId}
                highlightCommentId={highlightCommentId}
                // NEW: Pass keyboard navigation props
                focusedId={focusedId}
                registerItem={registerItem}
                isActive={isActive} // NEW
                setLastActiveId={setLastActiveId} // NEW
              />
            ))}
            {sortedComments.length > 3 && (
              <Button variant="link" onClick={() => setShowAllComments(prev => !prev)} className="p-0 h-auto text-sm text-muted-foreground">
                {showAllComments ? "Show less" : `View all ${sortedComments.length} comments`}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">No comments yet. Be the first to comment!</p>
        )}
        {activeAddress && showCommentForm && (
          <InteractionForm 
            type="comment" 
            project={project} 
            review={review} 
            onInteractionSuccess={() => {
              onInteractionSuccess();
              setShowCommentForm(false);
            }}
            className="mt-4"
          />
        )}
      </CollapsibleContent>
    </div>
  );
}