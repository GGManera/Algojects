"use client";

import { Comment, Project, Review, Reply } from "@/types/social";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation"; // Import hook type

interface CommentItemProps {
  comment: Comment;
  project: Project;
  review: Review;
  onInteractionSuccess: () => void;
  // REMOVED: writerTokenHoldings: Map<string, number>;
  // REMOVED: writerHoldingsLoading: boolean;
  projectSourceContext: { path: string; label: string };
  allCuratorData: AllCuratorCalculationsMap;
  expandCommentId?: string;
  highlightReplyId?: string;
  highlightCommentId?: string;
  // NEW: Keyboard navigation props
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean; // NEW PROP
  setLastActiveId: ReturnType<typeof useKeyboardNavigation>['setLastActiveId']; // NEW PROP
  globalViewMode: 'reviews' | 'comments' | 'replies' | 'interactions'; // NEW PROP
}

export function CommentItem({
  comment,
  project,
  review,
  onInteractionSuccess,
  projectSourceContext,
  allCuratorData,
  expandCommentId,
  highlightReplyId,
  highlightCommentId,
  focusedId,
  registerItem,
  isActive,
  setLastActiveId,
  globalViewMode, // NEW PROP
}: CommentItemProps) {
  const [areRepliesVisible, setAreRepliesVisible] = useState(false);
  const [showInteractionDetails, setShowInteractionDetails] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false); // NEW State for reply form
  const ref = useRef<HTMLDivElement>(null);
  const { activeAddress } = useWallet(); // Get active address

  const isHighlighted = useMemo(() => highlightCommentId === comment.id, [highlightCommentId, comment.id]);
  const isExcluded = comment.isExcluded;

  // NEW: 1. Calculate forced expansion state for replies
  const repliesCount = Object.keys(comment.replies || {}).length;
  const forcedRepliesState = useMemo(() => {
    switch (globalViewMode) {
      case 'reviews':
      case 'comments':
        return false; // Collapse replies
      case 'interactions':
        return true; // Expand all replies
      case 'replies':
        // Expand only if comment has replies
        return repliesCount > 0;
      default:
        return false;
    }
  }, [globalViewMode, repliesCount]);

  // NEW: 2. Synchronize local state with forced state when global mode changes
  useEffect(() => {
    if (areRepliesVisible !== forcedRepliesState) {
        setAreRepliesVisible(forcedRepliesState);
    }
  }, [globalViewMode, forcedRepliesState]);

  // NEW: 3. Use local state for rendering and registration
  const isRepliesVisible = areRepliesVisible;

  // NEW: Keyboard navigation state
  const isFocused = focusedId === comment.id;

  // NEW: Check if the comment is excluded AND the current user is NOT the sender
  const isHidden = isExcluded && activeAddress !== comment.sender;

  useEffect(() => {
    if (expandCommentId && expandCommentId === comment.id) {
      setAreRepliesVisible(true);
    }
  }, [expandCommentId, comment.id]);

  const handleToggleExpand = useCallback(() => {
    setAreRepliesVisible(prev => !prev);
    setShowReplyForm(false); // Collapse form when collapsing comment
  }, []);

  // Register item for keyboard navigation
  useEffect(() => {
    // Use isActive as a dependency to force re-registration when the slide becomes active
    const cleanup = registerItem(comment.id, handleToggleExpand, isRepliesVisible, 'comment');
    return cleanup;
  }, [comment.id, handleToggleExpand, isRepliesVisible, registerItem, isActive]); // Use isRepliesVisible here

  useEffect(() => {
    if (isHighlighted && ref.current) {
      setTimeout(() => {
        // Use 'start' block to rely on scroll-mt-header-offset
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [isHighlighted]);

  const toggleReplies = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggleExpand();
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    if (isExcluded) return; // Prevent interaction if excluded
    handleToggleExpand();
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
          "block w-full rounded-lg shadow-none overflow-hidden transition-all duration-300 cursor-pointer", // Removed border-2 border-transparent
          "rounded-lg",
          isHighlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          isFocused ? "focus-glow-border" : "", // Apply keyboard focus highlight
          !isFocused && "hover:focus-glow-border", // Apply hover focus highlight only if not already focused
          isExcluded 
            ? "bg-muted/30 border border-destructive/50 pointer-events-none" // Muted style for excluded
            : "bg-gradient-to-r from-comment-gradient-start/80 to-comment-gradient-end/80 text-white" // Normal style
        )}
        onClick={handleCardClick}
        onMouseEnter={() => setLastActiveId(comment.id)} // NEW: Set active ID on mouse enter
        onMouseLeave={() => setLastActiveId(null)} // NEW: Clear active ID on mouse leave
        data-nav-id={comment.id} // Add data attribute for keyboard navigation
      >
        <div className="p-3">
          <div className="flex items-start justify-between mb-2">
            <UserDisplay
              address={comment.sender}
              textSizeClass="text-base"
              avatarSizeClass="h-9 w-9"
              // REMOVED: projectTokenHoldings={writerTokenHoldings}
              // REMOVED: writerHoldingsLoading={writerHoldingsLoading}
              projectSourceContext={projectSourceContext}
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

          <CollapsibleContent isOpen={isRepliesVisible} className="pl-4 space-y-2">
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
                  // REMOVED: writerTokenHoldings={writerTokenHoldings}
                  // REMOVED: writerHoldingsLoading={writerHoldingsLoading}
                  projectSourceContext={projectSourceContext}
                  allCuratorData={allCuratorData}
                  isHighlighted={highlightReplyId === reply.id}
                  // NEW: Pass keyboard navigation props
                  focusedId={focusedId}
                  registerItem={registerItem}
                  isActive={isActive} // NEW
                  setLastActiveId={setLastActiveId} // NEW
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