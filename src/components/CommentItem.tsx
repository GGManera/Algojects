"use client";

import { Comment, Project, Review, Reply } from "@/types/social";
import { useState, useEffect, useMemo, useRef } from "react";
import { UserDisplay } from "./UserDisplay";
import { LikeButton } from "./LikeButton";
import { ReplyItem } from "./ReplyItem";
import { formatTimestamp, getCuratorWeightedLikeScore } from "@/lib/utils";
import { MessageSquare, Info, Star } from "lucide-react";
import { Button } from "./ui/button";
import { AllCuratorCalculationsMap } from "@/hooks/useCuratorIndex";
import { InteractionDetailsPanel } from "./InteractionDetailsPanel";
import { CollapsibleContent } from "./CollapsibleContent";
import { cn } from "@/lib/utils";
import { InteractionActionsMenu } from "./InteractionActionsMenu"; // NEW Import
import { InteractionForm } from "./InteractionForm"; // NEW Import for reply form
import { useWallet } from "@txnlab/use-wallet-react"; // Import useWallet

interface CommentItemProps {
  comment: Comment;
  project: Project;
  review: Review;
  onInteractionSuccess: () => void;
  writerTokenHoldings: Map<string, number>;
  writerHoldingsLoading: boolean;
  assetUnitName: string | null;
  projectSourceContext: { path: string; label: string };
  allCuratorData: AllCuratorCalculationsMap;
  expandCommentId?: string;
  highlightReplyId?: string;
  highlightCommentId?: string;
}

export function CommentItem({
  comment,
  project,
  review,
  onInteractionSuccess,
  writerTokenHoldings,
  writerHoldingsLoading,
  assetUnitName,
  projectSourceContext,
  allCuratorData,
  expandCommentId,
  highlightReplyId,
  highlightCommentId,
}: CommentItemProps) {
  const [areRepliesVisible, setAreRepliesVisible] = useState(false);
  const [showInteractionDetails, setShowInteractionDetails] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false); // NEW State for reply form
  const ref = useRef<HTMLDivElement>(null);
  const { activeAddress } = useWallet(); // Get active address

  const isHighlighted = useMemo(() => highlightCommentId === comment.id, [highlightCommentId, comment.id]);
  const isExcluded = comment.isExcluded;

  // NEW: Check if the comment is excluded AND the current user is NOT the sender
  const isHidden = isExcluded && activeAddress !== comment.sender;

  useEffect(() => {
    if (expandCommentId && expandCommentId === comment.id) {
      setAreRepliesVisible(true);
    }
  }, [expandCommentId, comment.id]);

  useEffect(() => {
    if (isHighlighted && ref.current) {
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [isHighlighted]);

  const repliesCount = Object.keys(comment.replies || {}).length;

  const toggleReplies = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAreRepliesVisible((prev) => !prev);
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    if (isExcluded) return; // Prevent interaction if excluded
    setAreRepliesVisible(prev => !prev);
    setShowInteractionDetails(false);
  };

  const curatorWeightedLikeScore = useMemo(() => {
    return getCuratorWeightedLikeScore(comment, allCuratorData);
  }, [comment, allCuratorData]);

  const handleReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAreRepliesVisible(true);
    setShowReplyForm(prev => !prev);
  };

  if (isHidden) {
    return null;
  }

  return (
    <div ref={ref} className={cn("ml-4 scroll-mt-header-offset")} id={comment.id}>
      <div 
        className={cn(
          "block w-full rounded-lg shadow-md overflow-hidden transition-all duration-300 cursor-pointer",
          isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          isExcluded 
            ? "bg-muted/30 border border-destructive/50 pointer-events-none" // Muted style for excluded
            : "bg-gradient-to-r from-comment-gradient-start/80 to-comment-gradient-end/80 text-white" // Normal style
        )}
        onClick={handleCardClick}
      >
        <div className="p-3">
          <div className="flex items-start justify-between mb-2">
            <UserDisplay
              address={comment.sender}
              textSizeClass="text-base"
              avatarSizeClass="h-9 w-9"
              projectTokenHoldings={writerTokenHoldings}
              assetUnitName={assetUnitName}
              sourceContext={projectSourceContext}
            />
            <div className="flex items-center space-x-2">
              <span className={cn("text-xs font-semibold", isExcluded ? "text-muted-foreground" : "text-white/70")}>{formatTimestamp(comment.timestamp)}</span>
              <InteractionActionsMenu 
                item={comment} 
                project={project} 
                review={review}
                onInteractionSuccess={onInteractionSuccess} 
              />
            </div>
          </div>
          {isExcluded ? (
            <p className="font-bold text-destructive/80 text-lg text-center py-2">[EXCLUDED]</p>
          ) : (
            <p className="whitespace-pre-wrap font-semibold selectable-text">{comment.content}</p>
          )}
        </div>
        
        {!isExcluded && (
          <div className="flex justify-around items-center p-1 text-white/70 border-t border-white/20">
            <LikeButton
              item={comment}
              project={project}
              review={review}
              onInteractionSuccess={onInteractionSuccess}
              className="hover:text-pink-400"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReplyClick} // Use new handler
              className="flex items-center space-x-2 hover:text-white transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="font-numeric">{repliesCount}</span>
            </Button>
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="font-numeric">{curatorWeightedLikeScore.toFixed(1)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setShowInteractionDetails(prev => !prev); }}
              className="flex items-center space-x-2 hover:text-white transition-colors"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Hide details panel and reply form if excluded */}
      {!isExcluded && (
        <>
          <CollapsibleContent isOpen={showInteractionDetails}>
            <InteractionDetailsPanel
              item={comment}
              project={project}
              review={review}
              onInteractionSuccess={onInteractionSuccess}
            />
          </CollapsibleContent>

          <CollapsibleContent isOpen={areRepliesVisible} className="pl-4 border-l-2 border-gray-700 space-y-2">
            {Object.values(comment.replies)
              .sort((a, b) => a.timestamp - b.timestamp)
              .filter(reply => !reply.isExcluded || activeAddress === reply.sender) // Filter excluded replies
              .map((reply) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  project={project}
                  review={review}
                  comment={comment}
                  onInteractionSuccess={onInteractionSuccess}
                  writerTokenHoldings={writerTokenHoldings}
                  writerHoldingsLoading={writerHoldingsLoading}
                  assetUnitName={assetUnitName}
                  projectSourceContext={projectSourceContext}
                  allCuratorData={allCuratorData}
                  isHighlighted={highlightReplyId === reply.id}
                />
              ))}
            {showReplyForm && (
              <InteractionForm
                type="reply"
                project={project}
                review={review}
                comment={comment}
                onInteractionSuccess={() => {
                  onInteractionSuccess();
                  setShowReplyForm(false);
                }}
              />
            )}
          </CollapsibleContent>
        </>
      )}
    </div>
  );
}