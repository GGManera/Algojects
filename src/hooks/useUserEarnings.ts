"use client";

import { useState, useEffect } from 'react';
import { ProjectsData, Review, Comment, Reply } from '@/types/social';

export function useUserEarnings(userAddress: string | undefined, projectsData: ProjectsData) {
  const [userEarnings, setUserEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userAddress || !projectsData) {
      setUserEarnings(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    let totalEarnings = 0;

    Object.values(projectsData).forEach(project => {
      Object.values(project.reviews).forEach(review => {
        // Earnings from reviews created by this user
        if (review.sender === userAddress) {
          // Each comment on their review: +0.25 ALGO
          totalEarnings += Object.values(review.comments).length * 0.25;
          // Each like on their review: +1 ALGO
          totalEarnings += review.likeCount * 1; // Corrected: use likeCount
        }

        Object.values(review.comments).forEach(comment => {
          // Earnings from comments created by this user
          if (comment.sender === userAddress) {
            // Each reply on their comment: +0.1 ALGO
            totalEarnings += Object.values(comment.replies).length * 0.1;
            // Each like on their comment: +0.25 ALGO
            totalEarnings += comment.likeCount * 0.25; // Corrected: use likeCount
          }

          // Earnings for review creator from likes on comments
          if (review.sender === userAddress) {
            // Each like on a comment on their review: +0.25 ALGO
            totalEarnings += comment.likeCount * 0.25; // Corrected: use likeCount
          }

          Object.values(comment.replies).forEach(reply => {
            // Earnings from replies created by this user
            if (reply.sender === userAddress) {
              // Each like on their reply: +0.1 ALGO
              totalEarnings += reply.likeCount * 0.1; // Corrected: use likeCount
            }

            // Earnings for comment creator from likes on replies
            if (comment.sender === userAddress) {
              // Each like on a reply on their comment: +0.1 ALGO
              totalEarnings += reply.likeCount * 0.1; // Corrected: use likeCount
            }

            // Earnings for review creator from likes on replies
            if (review.sender === userAddress) {
              // Each like on a reply on a comment on their review: +0.1 ALGO
              totalEarnings += reply.likeCount * 0.1; // Corrected: use likeCount
            }
          });
        });
      });
    });

    setUserEarnings(totalEarnings);
    setLoading(false);
  }, [userAddress, projectsData]);

  return { userEarnings, loading };
}