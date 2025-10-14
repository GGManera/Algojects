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
  const ref = useRef<HTMLDivElement>(null);

  const isHighlighted = useMemo(() => highlightCommentId === comment.id, [highlightCommentId, comment.id]);

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

  const curatorWeightedLikeScore = useMemo(() => {
    return getCuratorWeightedLikeScore(comment, allCuratorData);
  }, [comment, allCuratorData]);

  return (
    <div ref={ref} className="ml-4" id={comment.id}>
      <div className={cn(
        "block w-full bg-gradient-to-r from-comment-gradient-start/80 to-comment-gradient-end/80 text-white rounded-lg shadow-md overflow-hidden transition-all duration-300",
        isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}>
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
            <span className="text-xs text-white/70 font-semibold">{formatTimestamp(comment.timestamp)}</span>
          </div>
          <p className="whitespace-pre-wrap font-semibold selectable-text">{comment.content}</p>
        </div>
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
            onClick={toggleReplies}
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
      </div>

      <CollapsibleContent isOpen={showInteractionDetails}>
        <InteractionDetailsPanel
          item={comment}
          project={project}
          review={review}
          onInteractionSuccess={onInteractionSuccess}
        />
      </CollapsibleContent>

      <CollapsibleContent isOpen={areRepliesVisible}>
        <div className="pl-4 border-l-2 border-gray-700 space-y-2">
          {Object.values(comment.replies)
            .sort((a, b) => a.timestamp - b.timestamp)
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
        </div>
      </CollapsibleContent>
    </div>
  );
}