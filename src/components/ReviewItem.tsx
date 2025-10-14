"use client";

import { Review, Project, Comment } from "@/types/social";
import { CommentItem } from "./CommentItem";
import { LikeButton } from "./LikeButton";
import { InteractionForm } from "./InteractionForm";
import { useState, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { UserDisplay } from "./UserDisplay";
import { TrendingUp, Share2, MessageCircle, Gem, Star } from "lucide-react"; // NEW: Import Star icon
import { formatTimestamp, getCuratorWeightedLikeScore } from "@/lib/utils"; // NEW: Import getCuratorWeightedLikeScore
import { useNavigate } from "react-router-dom";
import { showError } from "@/utils/toast";
import { motion, AnimatePresence } from "framer-motion";
import { InteractionDetailsPanel } from "./InteractionDetailsPanel";
import { Skeleton } from "./ui/skeleton";
import { AllCuratorCalculationsMap } from '@/hooks/useCuratorIndex'; // NEW: Import AllCuratorCalculationsMap

interface ReviewItemProps {
  review: Review;
  project: Project;
  onInteractionSuccess: () => void;
  interactionScore: number;
  // initialExpanded?: boolean; // Removed
  // commentIdToExpand?: string; // Removed
  writerTokenHoldings: Map<string, number>;
  writerHoldingsLoading: boolean;
  assetUnitName: string | null;
  projectSourceContext: { path: string; label: string }; // NEW: Prop for project source context
  allCuratorData: AllCuratorCalculationsMap; // NEW: Prop for all curator data
}

const CONTENT_TRUNCATE_LENGTH = 280;

// Helper function to calculate interaction score for a comment
const getCommentInteractionScore = (comment: Comment): number => {
  let score = comment.likeCount || 0;
  const replies = Object.values(comment.replies || {});
  score += replies.length;
  replies.forEach(reply => {
    score += reply.likeCount || 0;
  });
  return score;
};

export function ReviewItem({ review, project, onInteractionSuccess, interactionScore, writerTokenHoldings, writerHoldingsLoading, assetUnitName, projectSourceContext, allCuratorData }: ReviewItemProps) { // Removed initialExpanded, commentIdToExpand
  const [isExpanded, setIsExpanded] = useState(false); // Default to false
  const [showAllComments, setShowAllComments] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [showInteractionDetails, setShowInteractionDetails] = useState(false);
  // const reviewRef = useRef<HTMLDivElement>(null); // Removed
  const navigate = useNavigate();

  // Removed useEffect for initialExpanded and scrollIntoView

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

  // NEW: Calculate Curator-Weighted Like Score
  const curatorWeightedLikeScore = useMemo(() => {
    return getCuratorWeightedLikeScore(review, allCuratorData);
  }, [review, allCuratorData]);

  return (
    <div 
      id={`review-${review.id.split('.')[1]}`}
      className="scroll-mt-header-offset"
    >
      <div 
        className="w-full bg-gradient-to-r from-gradient-start to-gradient-end text-white rounded-lg shadow-deep-lg overflow-hidden cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between p-2">
          {/* Removido o condicional writerHoldingsLoading aqui */}
          <UserDisplay 
            address={review.sender} 
            textSizeClass="text-base" 
            avatarSizeClass="h-10 w-10" 
            projectTokenHoldings={writerTokenHoldings}
            assetUnitName={assetUnitName}
            sourceContext={projectSourceContext} // NEW: Pass source context
          />
          <span className="text-xs text-white/70 font-semibold">{formatTimestamp(review.timestamp)}</span>
        </div>

        <div className="px-3 pb-2">
          <motion.p layout className="whitespace-pre-wrap font-semibold selectable-text">{displayContent}</motion.p>
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
          {/* NEW: Display Curator-Weighted Like Score */}
          <div className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-yellow-400" />
            <span className="font-numeric">{curatorWeightedLikeScore.toFixed(1)}</span>
          </div>
          <button className="flex items-center space-x-2 hover:text-white transition-colors">
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

      <AnimatePresence>
        {showInteractionDetails && (
          <InteractionDetailsPanel
            item={review}
            project={project}
            onInteractionSuccess={onInteractionSuccess}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden px-4 py-4 space-y-4"
          >
            {hasComments ? (
              <div className="space-y-4">
                {commentsToShow.map(({ comment, score }) => (
                  <CommentItem 
                    key={comment.id} 
                    comment={comment} 
                    review={review} 
                    project={project} 
                    onInteractionSuccess={onInteractionSuccess} 
                    interactionScore={score} 
                    // initialExpanded={comment.id.split('.')[2] === commentIdToExpand} // Removed
                    writerTokenHoldings={writerTokenHoldings}
                    assetUnitName={assetUnitName}
                    projectSourceContext={projectSourceContext} // NEW: Pass source context
                    allCuratorData={allCuratorData} // NEW: Pass allCuratorData
                  />
                ))}
                {sortedComments.length > 3 && (
                  <Button variant="link" onClick={() => setShowAllComments(prev => !prev)} className="p-0 h-auto text-sm text-muted-foreground">
                    {showAllComments ? "Show less" : `View all ${sortedComments.length} comments`}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-4">No comments yet. Be the first to comment!</p>
            )}

            <InteractionForm type="comment" project={project} review={review} onInteractionSuccess={onInteractionSuccess} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}