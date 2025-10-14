"use client";

import { Reply, Project, Review, Comment } from "@/types/social";
import { LikeButton } from "./LikeButton";
import { UserDisplay } from "./UserDisplay";
import { formatTimestamp, getCuratorWeightedLikeScore } from "@/lib/utils";
import { useState, useMemo } from "react";
import { Info, Gem, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { InteractionDetailsPanel } from "./InteractionDetailsPanel";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { AllCuratorCalculationsMap } from '@/hooks/useCuratorIndex';
import { CollapsibleContent } from "./CollapsibleContent";

interface ReplyItemProps {
  reply: Reply;
  project: Project;
  onInteractionSuccess: () => void;
  review: Review;
  comment: Comment;
  writerTokenHoldings: Map<string, number>;
  writerHoldingsLoading: boolean;
  assetUnitName: string | null;
  projectSourceContext: { path: string; label: string };
  allCuratorData: AllCuratorCalculationsMap;
}

const CONTENT_TRUNCATE_LENGTH = 150;

export function ReplyItem({ reply, project, onInteractionSuccess, review, comment, writerTokenHoldings, writerHoldingsLoading, assetUnitName, projectSourceContext, allCuratorData }: ReplyItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInteractionDetails, setShowInteractionDetails] = useState(false);

  const isLongReply = reply.content.length > CONTENT_TRUNCATE_LENGTH;
  const displayContent = isLongReply && !isExpanded
    ? `${reply.content.substring(0, CONTENT_TRUNCATE_LENGTH)}...`
    : reply.content;

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    setIsExpanded(prev => !prev);
    setShowInteractionDetails(false);
  };

  const curatorWeightedLikeScore = useMemo(() => {
    return getCuratorWeightedLikeScore(reply, allCuratorData);
  }, [reply, allCuratorData]);

  return (
    <div>
      <div 
        className="w-full bg-slate-100 text-black rounded-lg shadow-md overflow-hidden cursor-pointer border border-border"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between p-2">
          <UserDisplay 
            address={reply.sender} 
            textSizeClass="text-sm text-black"
            avatarSizeClass="h-8 w-8" 
            projectTokenHoldings={writerTokenHoldings}
            assetUnitName={assetUnitName}
            sourceContext={projectSourceContext}
          />
          <span className="text-xs text-gray-500 font-semibold">{formatTimestamp(reply.timestamp)}</span>
        </div>

        <div className="px-3 pb-2">
          <p className="whitespace-pre-wrap text-black/90 font-semibold selectable-text">{displayContent}</p>
          {isLongReply && !isExpanded && (
            <span className="text-blue-600 font-bold mt-2 inline-block">
              Continue reading
            </span>
          )}
        </div>

        <div className="flex justify-around items-center p-1 text-gray-500 border-t border-gray-200">
          <LikeButton
            item={reply}
            project={project}
            onInteractionSuccess={onInteractionSuccess}
            review={review}
            comment={comment}
            className="hover:text-pink-500"
          />
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-yellow-400" />
            <span className="font-numeric text-black">{curatorWeightedLikeScore.toFixed(1)}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setShowInteractionDetails(prev => !prev); }}
            className="flex items-center space-x-2 hover:text-black transition-colors"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CollapsibleContent isOpen={showInteractionDetails}>
        <InteractionDetailsPanel
          item={reply}
          project={project}
          review={review}
          comment={comment}
          onInteractionSuccess={onInteractionSuccess}
        />
      </CollapsibleContent>
    </div>
  );
}