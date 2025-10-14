"use client";

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocialData } from '@/hooks/useSocialData';
import { UserDisplay } from '@/components/UserDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { GlassRadioGroupTwoItems, GlassRadioItemTwoItems } from '@/components/GlassRadioGroupTwoItems';
import { Review, Comment, Reply, Project } from '@/types/social';

// Helper component to render a summary of a user's review
const UserReviewItem = ({ review, project }: { review: Review, project: Project }) => {
    const navigate = useNavigate();
    const handleNavigate = () => navigate(`/project/${project.id}#review-${review.id.split('.')[1]}`);

    return (
        <div
            className="block w-full bg-gradient-to-r from-gradient-start to-gradient-end text-white rounded-lg shadow-sm overflow-hidden mb-2 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={handleNavigate}
        >
            <div className="p-3">
                <p className="font-semibold truncate">{review.content}</p>
                <p className="text-xs text-white/70 mt-1">
                    Review for: <span className="font-bold">{project.id}</span>
                </p>
            </div>
        </div>
    );
};

// Helper component to render a summary of a user's comment
const UserCommentItem = ({ comment, review, project }: { comment: Comment, review: Review, project: Project }) => {
    const navigate = useNavigate();
    const handleNavigate = () => navigate(`/project/${project.id}#review-${review.id.split('.')[1]}`);

    return (
        <div
            className="block w-full bg-gradient-to-r from-comment-gradient-start/80 to-comment-gradient-end/80 text-white rounded-lg shadow-sm overflow-hidden mb-2 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={handleNavigate}
        >
            <div className="p-3">
                <p className="font-semibold truncate">{comment.content}</p>
                <p className="text-xs text-white/70 mt-1">
                    Comment on review for: <span className="font-bold">{project.id}</span>
                </p>
            </div>
        </div>
    );
};

// Helper component to render a summary of a user's reply
const UserReplyItem = ({ reply, review, project }: { reply: Reply, review: Review, project: Project }) => {
    const navigate = useNavigate();
    const handleNavigate = () => navigate(`/project/${project.id}#review-${review.id.split('.')[1]}`);

    return (
        <div
            className="block w-full bg-slate-300 text-black rounded-lg shadow-sm overflow-hidden mb-2 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={handleNavigate}
        >
            <div className="p-3">
                <p className="font-semibold truncate">{reply.content}</p>
                <p className="text-xs text-black/80 mt-1">
                    Reply on review for: <span className="font-bold">{project.id}</span>
                </p>
            </div>
        </div>
    );
};


export function UserProfile() {
    const { userAddress } = useParams<{ userAddress: string }>();
    const { projects, loading } = useSocialData();
    const [activeCategory, setActiveCategory] = useState<'writing' | 'curating'>('writing');

    const userContributions = useMemo(() => {
        const contributions = {
            reviews: [] as { review: Review, project: Project }[],
            comments: [] as { comment: Comment, review: Review, project: Project }[],
            replies: [] as { reply: Reply, comment: Comment, review: Review, project: Project }[],
        };

        if (!userAddress || loading) return contributions;

        for (const project of Object.values(projects)) {
            for (const review of Object.values(project.reviews)) {
                if (review.sender === userAddress) {
                    contributions.reviews.push({ review, project });
                }
                for (const comment of Object.values(review.comments)) {
                    if (comment.sender === userAddress) {
                        contributions.comments.push({ comment, review, project });
                    }
                    for (const reply of Object.values(comment.replies)) {
                        if (reply.sender === userAddress) {
                            contributions.replies.push({ reply, comment, review, project });
                        }
                    }
                }
            }
        }
        // Sort by timestamp descending
        contributions.reviews.sort((a, b) => b.review.timestamp - a.review.timestamp);
        contributions.comments.sort((a, b) => b.comment.timestamp - a.comment.timestamp);
        contributions.replies.sort((a, b) => b.reply.timestamp - a.reply.timestamp);

        return contributions;
    }, [userAddress, projects, loading]);

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <Skeleton className="h-12 w-64 mb-4" />
                <Skeleton className="h-10 w-full mb-8" />
                <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            </div>
        );
    }

    if (!userAddress) {
        return <div className="container mx-auto p-4">User address not found.</div>;
    }

    return (
        <div className="container mx-auto p-4 pt-20">
            <div className="mb-6">
                <UserDisplay address={userAddress} textSizeClass="text-2xl" avatarSizeClass="h-16 w-16" linkTo={null} />
            </div>

            <div className="mb-6">
                <GlassRadioGroupTwoItems
                    defaultValue={activeCategory}
                    onValueChange={(value) => setActiveCategory(value as 'writing' | 'curating')}
                >
                    <GlassRadioItemTwoItems value="writing" label="Writing" id="glass-category-writing" />
                    <GlassRadioItemTwoItems value="curating" label="Curating" id="glass-category-curating" />
                </GlassRadioGroupTwoItems>
            </div>

            {activeCategory === 'writing' && (
                <div>
                    <h2 className="text-xl font-bold mb-3 gradient-text">Reviews ({userContributions.reviews.length})</h2>
                    {userContributions.reviews.length > 0 ? (
                        userContributions.reviews.map(({ review, project }) => (
                            <UserReviewItem key={review.id} review={review} project={project} />
                        ))
                    ) : <p className="text-muted-foreground">No reviews written yet.</p>}

                    <h2 className="text-xl font-bold mb-3 mt-6 gradient-text">Comments ({userContributions.comments.length})</h2>
                    {userContributions.comments.length > 0 ? (
                        userContributions.comments.map(({ comment, review, project }) => (
                            <UserCommentItem key={comment.id} comment={comment} review={review} project={project} />
                        ))
                    ) : <p className="text-muted-foreground">No comments written yet.</p>}

                    <h2 className="text-xl font-bold mb-3 mt-6 gradient-text">Replies ({userContributions.replies.length})</h2>
                    {userContributions.replies.length > 0 ? (
                        userContributions.replies.map(({ reply, review, project }) => (
                            <UserReplyItem key={reply.id} reply={reply} review={review} project={project} />
                        ))
                    ) : <p className="text-muted-foreground">No replies written yet.</p>}
                </div>
            )}

            {activeCategory === 'curating' && (
                <div>
                    <h2 className="text-xl font-bold mb-3 gradient-text">Curating Activity</h2>
                    <p className="text-muted-foreground">Curating activity (likes given) will be displayed here.</p>
                </div>
            )}
        </div>
    );
}