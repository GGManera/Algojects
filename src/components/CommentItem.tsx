"use client";

import { Comment, Review, Project } from "@/types/social";
import { ReplyItem } from "./ReplyItem";
import { LikeButton } from "./LikeButton";
import { InteractionForm } from "./InteractionForm";
import { useState, useMemo } from "react";
import { UserDisplay } from "./UserDisplay";
import { TrendingUp, MessageSquare, Gem, Star } from "lucide-react";
import { formatTimestamp, getCuratorWeightedLikeScore } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { InteractionDetailsPanel } from "./InteractionDetailsPanel";
import { Skeleton } from "./ui/skeleton";
import { AllCuratorCalculationsMap } from '@/hooks/useCuratorIndex';
import { CollapsibleContent } from "./CollapsibleContent"; // ADDED

interface CommentItemProps {
  comment: Comment;
  review: Review;
  project: Project;
  onInteractionSuccess: () => void;
  interactionScore: number;
  // initialExpanded?: boolean; // Removed
  writerTokenHoldings: Map<string, number>;
  writerHoldingsLoading: boolean;
  assetUnitName: string | null;
  projectSourceContext: { path: string; label: string };
  allCuratorData: AllCuratorCalculationsMap;
}

const CONTENT_TRUNCATE_LENGTH = 200;

export function CommentItem({ comment, review, project, onInteractionSuccess, interactionScore, writerTokenHoldings, writerHoldingsLoading, assetUnitName, projectSourceContext, allCuratorData }: CommentItemProps) { // Removed initialExpanded
  const [isExpanded, setIsExpanded] = useState(false); // Default to false
  const [showInteractionDetails, setShowInteractionDetails] = useState(false);
  
  const sortedReplies = useMemo(() => {
    return Object.values(comment.replies || {}).sort((a, b) => a.timestamp - b.timestamp);
  }, [comment.replies]);

  const isLongComment = comment.content.length > CONTENT_TRUNCATE_LENGTH;
  const displayContent = isLongComment && !isExpanded
    ? `${comment.content.substring(0, CONTENT_TRUNCATE_LENGTH)}...`
    : comment.content;

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    setIsExpanded(prev => !prev);
  };

  // NEW: Calculate Curator-Weighted Like Score
  const curatorWeightedLikeScore = useMemo(() => {
    return getCuratorWeightedLikeScore(comment, allCuratorData);
  }, [comment, allCuratorData]);

  return (
    <div>
      <div 
        className="w-full bg-gradient-to-r from-comment-gradient-start/80 to-comment-gradient-end/80 text-white rounded-lg shadow-deep-md overflow-hidden cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between p-2">
          {/* Removido o condicional writerHoldingsLoading aqui */}
          <UserDisplay 
            address={comment.sender} 
            textSizeClass="text-base" 
            avatarSizeClass="h-9 w-9" 
            projectTokenHoldings={writerTokenHoldings}
            assetUnitName={assetUnitName}
            sourceContext={projectSourceContext} // NEW: Pass source context
          />
          <span className="text-xs text-white/70 font-semibold">{formatTimestamp(comment.timestamp)}</span>
        </div>

        <div className="px-3 pb-2">
          <p className="whitespace-pre-wrap font-semibold selectable-text">{displayContent}</p>
          {isLongComment && !isExpanded && (
            <span className="text-blue-200 font-bold mt-2 inline-block">
              Continue reading
            </span>
          )}
        </div>

        <div className="flex justify-around items-center p-1 text-white/70 border-t border-white/20">
          <button
            className="flex items-center space-x-2 hover:text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowInteractionDetails(prev => !prev); }}
          >
            <TrendingUp className="h-4 w-4" />
            <span className="font-numeric">{interactionScore}</span>
          </button>
          {/* NEW: Display Curator-Weighted Like Score */}
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-yellow-400" />
            <span className="font-numeric">{curatorWeightedLikeScore.toFixed(1)}</span>
          </div>
          <button className="flex items-center space-x-2 hover:text-white transition-colors">
            <MessageSquare className="h-4 w-4" />
            <span className="font-numeric">{sortedReplies.length}</span>
          </button>
          <LikeButton
            item={comment}
            project={project}
            onInteractionSuccess={onInteractionSuccess}
            review={review}
            className="hover:text-pink-200"
          />
        </div>
      </div>

      <CollapsibleContent isOpen={showInteractionDetails}>
        <InteractionDetailsPanel
          item={comment}
          project={project}
          review={review}
          onInteractionSuccess={onInteractionSuccess}
        />
      </CollapsibleContent>

      <CollapsibleContent isOpen={isExpanded} className="p-3">
        <div className="space-y-3">
          {sortedReplies.map(reply => (
            <ReplyItem 
              key={reply.id} 
              reply={reply} 
              project={project} 
              onInteractionSuccess={onInteractionSuccess} 
              review={review} 
              comment={comment} 
              writerTokenHoldings={writerTokenHoldings}
              assetUnitName={assetUnitName}
              projectSourceContext={projectSourceContext} // NEW: Pass source context
              allCuratorData={allCuratorData} // NEW: Pass allCuratorData
            />
          ))}
          <InteractionForm type="reply" project={project} review={review} comment={comment} onInteractionSuccess={onInteractionSuccess} />
        </div>
      </CollapsibleContent>
    </div>
  );
}