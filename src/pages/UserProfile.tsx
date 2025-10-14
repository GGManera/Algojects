"use client";

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocialData } from '@/hooks/useSocialData';
import { useCuratorIndex } from '@/hooks/useCuratorIndex';
import { UserDisplay } from '@/components/UserDisplay';
import { UserStatsCard } from '@/components/UserStatsCard';
import { GlassRadioGroupTwoItems, GlassRadioItemTwoItems } from '@/components/GlassRadioGroupTwoItems';
import { Skeleton } from '@/components/ui/skeleton';
import { Review, Comment, Reply, Project } from '@/types/social';

interface UserComment extends Comment { parentReview: Review; parentProject: Project; }
interface UserReply extends Reply { parentComment: Comment; parentReview: Review; parentProject: Project; }
interface UserLike { item: Review | Comment | Reply; project: Project; }

export function UserProfile() {
  const { userAddress } = useParams<{ userAddress: string }>();
  const navigate = useNavigate();
  const { projects, loading: socialDataLoading } = useSocialData();
  const { allCuratorCalculations, isLoading: curatorIndexLoading } = useCuratorIndex(projects);

  const [activeCategory, setActiveCategory] = useState<'writing' | 'curating'>('writing');

  const { userReviews, userComments, userReplies, userLikes, userStats } = useMemo(() => {
    const reviews: (Review & { parentProject: Project })[] = [];
    const comments: UserComment[] = [];
    const replies: UserReply[] = [];
    const likes: UserLike[] = [];
    let totalLikesGiven = 0;
    let amountSpentOnLikes = 0;

    if (userAddress) {
      Object.values(projects).forEach(project => {
        Object.values(project.reviews).forEach(review => {
          if (review.sender === userAddress) {
            reviews.push({ ...review, parentProject: project });
          }
          if (review.likes.has(userAddress)) {
            likes.push({ item: review, project });
            totalLikesGiven++;
            amountSpentOnLikes += 1; // 1 ALGO
          }

          Object.values(review.comments).forEach(comment => {
            if (comment.sender === userAddress) {
              comments.push({ ...comment, parentReview: review, parentProject: project });
            }
            if (comment.likes.has(userAddress)) {
              likes.push({ item: comment, project });
              totalLikesGiven++;
              amountSpentOnLikes += 0.5; // 0.5 ALGO
            }

            Object.values(comment.replies).forEach(reply => {
              if (reply.sender === userAddress) {
                replies.push({ ...reply, parentComment: comment, parentReview: review, parentProject: project });
              }
              if (reply.likes.has(userAddress)) {
                likes.push({ item: reply, project });
                totalLikesGiven++;
                amountSpentOnLikes += 0.3; // 0.3 ALGO
              }
            });
          });
        });
      });
    }
    
    reviews.sort((a, b) => b.timestamp - a.timestamp);
    comments.sort((a, b) => b.timestamp - a.timestamp);
    replies.sort((a, b) => b.timestamp - a.timestamp);
    likes.sort((a, b) => b.item.timestamp - a.item.timestamp);

    const curatorData = allCuratorCalculations.get(userAddress!);
    const stats = {
      earnings: 0, // Placeholder for earnings calculation
      totalLikesGiven,
      amountSpentOnLikes,
      overallCuratorIndex: curatorData?.overallCuratorIndex ?? 0,
      a1Score: curatorData?.a1Score ?? 0,
      a2Score: curatorData?.a2Score ?? 0,
      mitigationFactor: curatorData?.mitigationFactor ?? 0,
      d1DiversityWriters: curatorData?.d1DiversityWriters ?? 0,
      d2DiversityProjects: curatorData?.d2DiversityProjects ?? 0,
      d3Recency: curatorData?.d3Recency ?? 0,
    };

    return { userReviews: reviews, userComments: comments, userReplies: replies, userLikes: likes, userStats: stats };
  }, [projects, userAddress, allCuratorCalculations]);

  const handleNavigate = (path: string) => {
    navigate(path);
    window.scrollTo(0, 0);
  };

  const isLoading = socialDataLoading || curatorIndexLoading;

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-64 w-full max-w-md mx-auto mb-8" />
        <Skeleton className="h-12 w-full max-w-md mx-auto mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!userAddress) {
    return <p className="p-4 text-center">No user address provided.</p>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-center mb-8">
        <UserDisplay address={userAddress} className="flex-col items-center" avatarSizeClass="h-24 w-24" textSizeClass="text-2xl text-center" />
      </div>

      <UserStatsCard userAddress={userAddress} isLoading={isLoading} {...userStats} />

      <div className="max-w-md mx-auto mb-8">
        <GlassRadioGroupTwoItems defaultValue="writing" onValueChange={(value) => setActiveCategory(value as 'writing' | 'curating')}>
          <GlassRadioItemTwoItems value="writing" label="Writing" id="glass-category-writing" />
          <GlassRadioItemTwoItems value="curating" label="Curating" id="glass-category-curating" />
        </GlassRadioGroupTwoItems>
      </div>

      <div>
        {activeCategory === 'writing' ? (
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4 gradient-text">Reviews ({userReviews.length})</h2>
              {userReviews.length > 0 ? (
                <div className="space-y-2">
                  {userReviews.map(review => (
                    <div key={review.id} className="block w-full bg-gradient-to-r from-gradient-start to-gradient-end text-white rounded-lg shadow-sm p-4 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onClick={() => handleNavigate(`/project/${review.parentProject.id}#review-${review.id.split('.')[1]}`)}>
                      <p className="font-semibold truncate">{review.content}</p>
                      <p className="text-xs text-white/70 mt-1">Review for <strong>{review.parentProject.id}</strong></p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground">No reviews from this user.</p>}
            </section>
            <section>
              <h2 className="text-2xl font-bold mb-4 gradient-text">Comments ({userComments.length})</h2>
              {userComments.length > 0 ? (
                <div className="space-y-2">
                  {userComments.map(comment => (
                    <div key={comment.id} className="block w-full bg-gradient-to-r from-comment-gradient-start/80 to-comment-gradient-end/80 text-white rounded-lg shadow-sm p-4 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onClick={() => handleNavigate(`/project/${comment.parentProject.id}#review-${comment.parentReview.id.split('.')[1]}`)}>
                      <p className="font-semibold truncate">{comment.content}</p>
                      <p className="text-xs text-white/70 mt-1">Comment on a review for <strong>{comment.parentProject.id}</strong></p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground">No comments from this user.</p>}
            </section>
            <section>
              <h2 className="text-2xl font-bold mb-4 gradient-text">Replies ({userReplies.length})</h2>
              {userReplies.length > 0 ? (
                <div className="space-y-2">
                  {userReplies.map(reply => (
                    <div key={reply.id} className="block w-full bg-slate-300 text-black rounded-lg shadow-sm p-4 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onClick={() => handleNavigate(`/project/${reply.parentProject.id}#review-${reply.parentReview.id.split('.')[1]}`)}>
                      <p className="font-semibold truncate">{reply.content}</p>
                      <p className="text-xs text-black/70 mt-1">Reply on a comment for <strong>{reply.parentProject.id}</strong></p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground">No replies from this user.</p>}
            </section>
          </div>
        ) : (
          <section>
            <h2 className="text-2xl font-bold mb-4 gradient-text">Curated Content ({userLikes.length})</h2>
            {userLikes.length > 0 ? (
              <div className="space-y-2">
                {userLikes.map(like => (
                  <div key={like.item.id} className="block w-full bg-card border rounded-lg p-4 cursor-pointer hover:bg-muted" onClick={() => handleNavigate(`/project/${like.project.id}`)}>
                    <p className="font-semibold truncate">{like.item.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">Liked content on <strong>{like.project.id}</strong></p>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground">No liked content from this user.</p>}
          </section>
        )}
      </div>
    </div>
  );
}