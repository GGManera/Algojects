"use client";

import { Reply, Project, Review, Comment } from "@/types/social";
import { LikeButton } from "./LikeButton";
import { UserDisplay } from "./UserDisplay";
import { formatTimestamp, getCuratorWeightedLikeScore } from "@/lib/utils";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Info, Gem, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { InteractionDetailsPanel } from "./InteractionDetailsPanel";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { AllCuratorCalculationsMap } from '@/hooks/useCuratorIndex';
import { CollapsibleContent } from "./CollapsibleContent";
import { cn } from "@/lib/utils";
import { InteractionActionsMenu } from "./InteractionActionsMenu"; // NEW Import
import { useWallet } from "@txnlab/use-wallet-react"; // Import useWallet
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation"; // Import hook type

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
  isHighlighted?: boolean;
  // NEW: Keyboard navigation props
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean; // NEW PROP
}

const CONTENT_TRUNCATE_LENGTH = 150;

export function ReplyItem({ reply, project, onInteractionSuccess, review, comment, writerTokenHoldings, writerHoldingsLoading, assetUnitName, projectSourceContext, allCuratorData, isHighlighted = false, focusedId, registerItem, isActive }: ReplyItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInteractionDetails, setShowInteractionDetails] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { activeAddress } = useWallet(); // Get active address

  const isExcluded = reply.isExcluded;

  // NEW: Keyboard navigation state
  const isFocused = focusedId === reply.id;

  // NEW: Check if the reply is excluded AND the current user is NOT the sender
  const isHidden = isExcluded && activeAddress !== reply.sender;

  useEffect(() => {
    if (isHighlighted && ref.current) {
      setTimeout(() => {
        // Use 'center' block for small elements like replies for better visibility
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300); // Delay to allow for expansion animation
    }
  }, [isHighlighted]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Register item for keyboard navigation
  useEffect(() => {
    // Use isActive as a dependency to force re-registration when the slide becomes active
    const cleanup = registerItem(reply.id, handleToggleExpand, isExpanded, 'reply');
    return cleanup;
  }, [reply.id, handleToggleExpand, isExpanded, registerItem, isActive]); // ADDED isActive

  const isLongReply = reply.content.length > CONTENT_TRUNCATE_LENGTH;
  const displayContent = isLongReply && !isExpanded
    ? `${reply.content.substring(0, CONTENT_TRUNCATE_LENGTH)}...`
    : reply.content;

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    if (isExcluded) return; // Prevent interaction if excluded
    handleToggleExpand();
    setShowInteractionDetails(false);
  };

  const curatorWeightedLikeScore = useMemo(() => {
    return getCuratorWeightedLikeScore(reply, allCuratorData);
  }, [reply, allCuratorData]);

  if (isHidden) {
    return null;
  }

  return (
    <div ref={ref} id={reply.id} className="scroll-mt-header-offset">
      <div 
        className={cn(
          "w-full rounded-lg shadow-md overflow-hidden cursor-pointer transition-all duration-300",
          isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          isFocused ? "focus-glow-border" : "", // Apply new focus highlight
          isExcluded 
            ? "bg-muted/30 border border-destructive/50 pointer-events-none" // Muted style for excluded
            : "bg-gradient-to-r from-notes-gradient-start/90 to-notes-gradient-end/90 text-black" // Normal style
        )}
        onClick={handleCardClick}
        data-nav-id={reply.id} // Add data attribute for keyboard navigation
      >
        <div className="flex items-start justify-between p-2">
          <UserDisplay 
            address={reply.sender} 
            textSizeClass="text-sm text-black"
            avatarSizeClass="h-8 w-8" 
            projectTokenHoldings={writerTokenHoldings}
            writerHoldingsLoading={writerHoldingsLoading}
            assetUnitName={assetUnitName}
            projectSourceContext={projectSourceContext}
          />
          <div className="flex items-center space-x-2">
            <span className={cn("text-xs font-semibold", isExcluded ? "text-muted-foreground" : "text-black/70")}>{formatTimestamp(reply.timestamp)}</span>
            <InteractionActionsMenu 
              item={reply} 
              project={project} 
              review={review}
              comment={comment}
              onInteractionSuccess={onInteractionSuccess} 
            />
          </div>
        </div>

        <div className="px-3 pb-2">
          {isExcluded ? (
            <p className="font-bold text-destructive/80 text-base text-center py-1">[EXCLUDED]</p>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-black font-semibold selectable-text">{displayContent}</p>
              {isLongReply && !isExpanded && (
                <span className="text-blue-700 font-bold mt-2 inline-block">
                  Continue reading
                </span>
              )}
            </>
          )}
        </div>

        {!isExcluded && (
          <div className="flex justify-around items-center p-1 text-black/70 border-t border-black/20">
            <LikeButton
              item={reply}
              project={project}
              onInteractionSuccess={onInteractionSuccess}
              review={review}
              comment={comment}
              className="hover:text-pink-400"
            />
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="font-numeric">{curatorWeightedLikeScore.toFixed(1)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setShowInteractionDetails(prev => !prev); }}
              className="flex items-center space-x-2 hover:text-foreground transition-colors"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {!isExcluded && (
        <CollapsibleContent isOpen={showInteractionDetails}>
          <InteractionDetailsPanel
            item={reply}
            project={project}
            review={review}
            comment={comment}
            onInteractionSuccess={onInteractionSuccess}
          />
        </CollapsibleContent>
      )}
    </div>
  );
}