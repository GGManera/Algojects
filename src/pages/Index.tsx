"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { UserDisplay } from '@/components/UserDisplay';
import { TrendingUp, Star, MessageCircle, Heart, Share2 } from 'lucide-react';

const mockReview = {
  id: 'r1',
  authorAddress: 'gabriel',
  content: 'first post?',
  date: 'Sep 25, 2025',
  stats: {
    trending: 16,
    stars: 24.9,
    comments: 4,
    likes: 5,
  }
};

const mockComments = [
  { id: 'c1', authorAddress: 'gabriel.monko', content: 'first comment?', date: 'Sep 25, 2025', stats: { trending: 4, stars: 11.4, comments: 1, likes: 2 } },
  { id: 'c2', authorAddress: 'mrpresident', content: 'Presidential comment 😎', date: 'Oct 1, 2025', stats: { trending: 2, stars: 5.4, comments: 1, likes: 1 } },
  { id: 'c3', authorAddress: 'gabriel', content: 'another comment from me!', date: 'Sep 25, 2025', stats: { trending: 8, stars: 12.1, comments: 0, likes: 3 } },
];

const StatIcon = ({ icon, value }: { icon: React.ReactNode, value: string | number }) => (
  <div className="flex items-center gap-2 text-white/80">
    {icon}
    <span className="font-numeric">{value}</span>
  </div>
);

const ReviewCard = ({ review }: { review: any }) => (
  <Card className="bg-gradient-to-br from-teal-500/30 to-cyan-500/30 border-teal-400/50 rounded-xl overflow-hidden">
    <CardContent className="p-4 text-white">
      <div className="flex justify-between items-start">
        <UserDisplay address={review.authorAddress} />
        <span className="text-xs text-white/70">{review.date}</span>
      </div>
      <p className="mt-4 text-lg">{review.content}</p>
      <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between text-sm">
        <StatIcon icon={<TrendingUp size={16} />} value={review.stats.trending} />
        <StatIcon icon={<Star size={16} />} value={review.stats.stars} />
        <StatIcon icon={<MessageCircle size={16} />} value={review.stats.comments} />
        <StatIcon icon={<Heart size={16} />} value={review.stats.likes} />
        <Share2 size={16} className="text-white/80 cursor-pointer" />
      </div>
    </CardContent>
  </Card>
);

const CommentCard = ({ comment }: { comment: any }) => (
  <Card className="bg-gradient-to-br from-red-500/30 to-orange-500/30 border-red-400/50 rounded-xl overflow-hidden">
    <CardContent className="p-4 text-white">
      <div className="flex justify-between items-start">
        <UserDisplay address={comment.authorAddress} />
        <span className="text-xs text-white/70">{comment.date}</span>
      </div>
      <p className="mt-4">{comment.content}</p>
      <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-6 text-sm">
        <StatIcon icon={<TrendingUp size={16} />} value={comment.stats.trending} />
        <StatIcon icon={<Star size={16} />} value={comment.stats.stars} />
        <StatIcon icon={<MessageCircle size={16} />} value={comment.stats.comments} />
        <StatIcon icon={<Heart size={16} />} value={comment.stats.likes} />
      </div>
    </CardContent>
  </Card>
);

export default function Index() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto bg-gray-900 text-white min-h-screen">
      <div className="space-y-6">
        <ReviewCard review={mockReview} />
        {mockComments.map(comment => (
          <CommentCard key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
}