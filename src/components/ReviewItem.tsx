"use client";

import { Review, Project, Comment } from "@/types/social";
import { CommentItem } from "./CommentItem";
import { LikeButton } from "./LikeButton";
import { InteractionForm } from "./InteractionForm";
import { useState, useMemo, useEffect } from "react";
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

export function ReviewItem({ review, project, onInteractionSuccess, interactionScore, writerTokenHoldings, writerHoldingsLoading, assetUnitName, projectSourceContext, allCuratorData }: ReviewItemProps) {
  const location = useLocation();
  const { expandCommentId, highlightReplyId, highlightCommentId } = (location.state as { expandCommentId?: string; highlightReplyId?: string; highlightCommentId?: string; }) || {};

  const containsTargetComment = useMemo(() => {
    if (!expandCommentId || !review.comments) return false;
    return expandCommentId.startsWith(review.id + '.');
  }, [expandCommentId, review.id]);

  const [isExpanded, setIsExpanded] = useState(containsTargetComment);
  const [showAllComments, setShowAllComments] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [showInteractionDetails, setShowInteractionDetails] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const { activeAddress } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (containsTargetComment) {
      setIsExpanded(true);
    }
  }, [containsTargetComment]);

  const sortedComments = useMemo(() => {
    const allComments = Object.values(review.comments || {});
    return allComments
      .map(comment => ({
        comment,
        score: getCommentInteractionScore(comment),
      }))
      .sort((a, b) => b.score - a.score);
  }, [review.comments]);

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
    setIsExpanded(prev => !prev);
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

  return (
    <div 
      id={`review-${review.id.split('.')[1]}`}
      className="scroll-mt-header-offset mb-4"
    >
      <div 
        className="w-full bg-gradient-to-r from-gradient-start to-gradient-end text-white rounded-lg overflow-hidden cursor-pointer"
        onClick={handleCardClick}
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
          <span className="text-xs text-white/70 font-semibold">{formatTimestamp(review.timestamp)}</span>
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