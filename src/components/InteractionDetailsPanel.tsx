"use client";

import React, { useState, useMemo } from 'react';
import { UserDisplay } from './UserDisplay';
import { BaseInteraction, Review, Comment, Project } from '@/types/social';
import { formatTimestamp } from '@/lib/utils';
import { Heart, MessageCircle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useNfdResolver } from '@/hooks/useNfdResolver';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { CollapsibleContent } from './CollapsibleContent'; // ADDED for nested replies

interface InteractionDetailsPanelProps {
  item: BaseInteraction; // The current item (Review, Comment, or Reply)
  project: Project;
  review?: Review; // Parent review if item is a comment or reply
  comment?: Comment; // Parent comment if item is a reply
  onInteractionSuccess: () => void; // For potential future actions
}

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinalSuffix = (n: number): string => {
  if (n % 100 >= 11 && n % 100 <= 13) {
    return n + "th";
  }
  switch (n % 10) {
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
  }
};

export function InteractionDetailsPanel({ item, project, review, comment, onInteractionSuccess }: InteractionDetailsPanelProps) {
  const [showRepliesForComment, setShowRepliesForComment] = useState<{ [commentId: string]: boolean }>({});
  const [expandedTimestamps, setExpandedTimestamps] = useState<Set<string>>(new Set()); // NEW state for expanded timestamps

  // Determine item type
  const idParts = item.id.split('.');
  const itemType = idParts.length === 2 ? 'review' : idParts.length === 3 ? 'comment' : 'reply';

  // Collect all unique addresses involved in likes, comments, and replies for NFD resolution
  const allAddressesToResolve = useMemo(() => {
    const addresses = new Set<string>();
    item.likeHistory.forEach(like => addresses.add(like.sender));

    if (itemType === 'review' && (item as Review).comments) {
      Object.values((item as Review).comments).forEach(c => {
        addresses.add(c.sender);
        c.likeHistory.forEach(like => addresses.add(like.sender));
        Object.values(c.replies).forEach(r => {
          addresses.add(r.sender);
          r.likeHistory.forEach(like => addresses.add(like.sender));
        });
      });
    } else if (itemType === 'comment' && (item as Comment).replies) {
      Object.values((item as Comment).replies).forEach(r => {
        addresses.add(r.sender);
        r.likeHistory.forEach(like => addresses.add(like.sender));
      });
    }
    return Array.from(addresses);
  }, [item, itemType]);

  const { resolvedAddresses, loading: nfdResolving } = useNfdResolver(allAddressesToResolve);

  // Aggregate nested like counts for reviews
  const aggregatedLikes = useMemo(() => {
    if (itemType !== 'review') return { comments: 0, replies: 0 };
    let commentLikes = 0;
    let replyLikes = 0;
    Object.values((item as Review).comments).forEach(c => {
      commentLikes += c.likeCount;
      Object.values(c.replies).forEach(r => {
        replyLikes += r.likeCount;
      });
    });
    return { comments: commentLikes, replies: replyLikes };
  }, [item, itemType]);

  const sortedLikes = useMemo(() => {
    return item.likeHistory
      .filter(like => like.action === 'LIKE') // Only show actual likes
      .sort((a, b) => a.timestamp - b.timestamp); // First to last
  }, [item.likeHistory]);

  const sortedComments = useMemo(() => {
    if (itemType !== 'review') return [];
    return Object.values((item as Review).comments).sort((a, b) => a.timestamp - b.timestamp);
  }, [item, itemType]);

  // Collect and sort all replies for a review
  const allRepliesForReview = useMemo(() => {
    if (itemType !== 'review') return [];
    const replies: (BaseInteraction & { parentCommentId: string })[] = [];
    Object.values((item as Review).comments).forEach(c => {
      Object.values(c.replies).forEach(r => {
        replies.push({ ...r, parentCommentId: c.id }); // Add parent comment ID for context if needed
      });
    });
    return replies.sort((a, b) => a.timestamp - b.timestamp);
  }, [item, itemType]);

  const toggleReplies = (commentId: string) => {
    setShowRepliesForComment(prev => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  // NEW: Function to handle timestamp click
  const handleTimestampClick = (txId: string) => {
    setExpandedTimestamps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(txId)) {
        newSet.delete(txId);
      } else {
        newSet.add(txId);
      }
      return newSet;
    });
  };

  const renderTimestamp = (timestamp: number, txId: string) => (
    <span
      className="text-xs text-muted-foreground cursor-pointer hover:underline"
      onClick={(e) => { e.stopPropagation(); handleTimestampClick(txId); }} // Stop propagation to prevent parent card click
    >
      {expandedTimestamps.has(txId) ? new Date(timestamp * 1000).toLocaleString() : formatTimestamp(timestamp)}
    </span>
  );

  return (
    <div
      className="bg-card p-4 rounded-lg mt-4 border border-muted"
    >
      <h4 className="text-lg font-bold gradient-text mb-4">Interaction Details</h4>

      {/* Likes Section */}
      <div className="mb-4">
        <h5 className="text-md font-semibold text-muted-foreground flex items-center gap-1 mb-2">
          <Heart className="h-4 w-4" /> Likes ({item.likeCount})
        </h5>
        {nfdResolving ? (
          <Skeleton className="h-16 w-full" />
        ) : sortedLikes.length > 0 ? (
          <ul className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
            {sortedLikes.map((like, index) => (
              <li key={index} className="flex items-center justify-between text-sm p-1 rounded-md bg-muted/20">
                <div className="flex items-center gap-2"> {/* Group ordinal and UserDisplay */}
                  <span className="text-xs text-muted-foreground font-semibold w-8 text-right">{getOrdinalSuffix(index + 1)}</span>
                  <UserDisplay address={like.sender} avatarSizeClass="h-6 w-6" textSizeClass="text-sm" />
                </div>
                {renderTimestamp(like.timestamp, like.txId)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No likes yet.</p>
        )}
      </div>

      {/* Review-specific details: Comments and aggregated likes */}
      {itemType === 'review' && (
        <>
          <div className="mb-4">
            <h5 className="text-md font-semibold text-muted-foreground flex items-center gap-1 mb-2">
              <MessageCircle className="h-4 w-4" /> Comments ({Object.keys((item as Review).comments).length})
            </h5>
            {nfdResolving ? (
              <Skeleton className="h-24 w-full" />
            ) : sortedComments.length > 0 ? (
              <ul className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
                {sortedComments.map((c, index) => (
                  <li key={c.id} className="p-2 rounded-md bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"> {/* Group ordinal and UserDisplay */}
                        <span className="text-xs text-muted-foreground font-semibold w-8 text-right">{getOrdinalSuffix(index + 1)}</span>
                        <UserDisplay address={c.sender} avatarSizeClass="h-6 w-6" textSizeClass="text-sm" />
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleReplies(c.id); }} className="h-auto p-1 text-xs text-muted-foreground">
                        {Object.keys(c.replies).length} Replies {showRepliesForComment[c.id] ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                      </Button>
                    </div>
                    <CollapsibleContent isOpen={showRepliesForComment[c.id]} className="pl-4 pt-2 mt-2 border-t border-muted">
                          <h6 className="text-sm font-semibold text-muted-foreground mb-1">Replies:</h6>
                          {Object.values(c.replies).length > 0 ? (
                            <ul className="space-y-1">
                              {Object.values(c.replies).sort((a, b) => a.timestamp - b.timestamp).map((r, replyIndex) => (
                                <li key={r.id} className="flex items-center gap-2 text-sm">
                                  <div className="flex items-center gap-1"> {/* Group ordinal and UserDisplay */}
                                    <span className="text-xs text-muted-foreground font-semibold w-6 text-right">{getOrdinalSuffix(replyIndex + 1)}</span>
                                    <UserDisplay address={r.sender} avatarSizeClass="h-5 w-5" textSizeClass="text-xs" />
                                  </div>
                                  {renderTimestamp(r.timestamp, r.txId)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">No replies.</p>
                          )}
                    </CollapsibleContent>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
          </div>

          {/* All Replies Section for Reviews */}
          <div className="mb-4">
            <h5 className="text-md font-semibold text-muted-foreground flex items-center gap-1 mb-2">
              <MessageSquare className="h-4 w-4" /> All Replies ({allRepliesForReview.length})
            </h5>
            {nfdResolving ? (
              <Skeleton className="h-16 w-full" />
            ) : allRepliesForReview.length > 0 ? (
              <ul className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                {allRepliesForReview.map((r, index) => (
                  <li key={r.id} className="flex items-center justify-between text-sm p-1 rounded-md bg-muted/20">
                    <div className="flex items-center gap-2"> {/* Group ordinal and UserDisplay */}
                      <span className="text-xs text-muted-foreground font-semibold w-8 text-right">{getOrdinalSuffix(index + 1)}</span>
                      <UserDisplay address={r.sender} avatarSizeClass="h-6 w-6" textSizeClass="text-sm" />
                    </div>
                    {renderTimestamp(r.timestamp, r.txId)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No replies yet for this review.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col items-center p-2 rounded-md bg-muted/20">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <span className="font-numeric font-semibold">{aggregatedLikes.comments}</span>
              <span className="text-xs text-muted-foreground">Likes on Comments</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-md bg-muted/20">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <span className="font-numeric font-semibold">{aggregatedLikes.replies}</span>
              <span className="text-xs text-muted-foreground">Likes on Replies</span>
            </div>
          </div>
        </>
      )}

      {/* Comment-specific details: Replies */}
      {itemType === 'comment' && (
        <div className="mb-4">
          <h5 className="text-md font-semibold text-muted-foreground flex items-center gap-1 mb-2">
            <MessageSquare className="h-4 w-4" /> Replies ({Object.keys((item as Comment).replies).length})
          </h5>
          {nfdResolving ? (
            <Skeleton className="h-16 w-full" />
          ) : Object.values((item as Comment).replies).length > 0 ? (
            <ul className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
              {Object.values((item as Comment).replies).sort((a, b) => a.timestamp - b.timestamp).map((r, index) => (
                <li key={r.id} className="flex items-center gap-2 text-sm p-1 rounded-md bg-muted/20">
                  <div className="flex items-center gap-2"> {/* Group ordinal and UserDisplay */}
                    <span className="text-xs text-muted-foreground font-semibold w-8 text-right">{getOrdinalSuffix(index + 1)}</span>
                    <UserDisplay address={r.sender} avatarSizeClass="h-6 w-6" textSizeClass="text-sm" />
                  </div>
                  {renderTimestamp(r.timestamp, r.txId)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No replies yet.</p>
          )}
        </div>
      )}
    </div>
  );
}