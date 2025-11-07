"use client";

import { useState, useEffect, useMemo } from 'react';
import { ProjectsData, Review, Comment, Reply } from '@/types/social';
import {
  useCuratorIndex, // Import the new useCuratorIndex hook
  CuratorIndexData, // Import CuratorIndexData interface
  AllCuratorCalculationsMap // Import the map of all curator calculations
} from './useCuratorIndex'; // Import constants and interface from useCuratorIndex

// Constants for like costs (still used for earnings calculation)
export const LIKE_REVIEW_COST = 1.0;
export const LIKE_COMMENT_COST = 0.5;
export const LIKE_REPLY_COST = 0.3;

interface UserAnalytics {
  address: string;
  totalEarnings: number; // In ALGO
  overallCuratorIndex: number; // From new CuratorIndexData
  inactivityPenalty: number; // From new CuratorIndexData (D3)
  totalLikesGiven: number; // From new CuratorIndexData
  amountSpentOnLikes: number; // In ALGO
}

interface PlatformAnalyticsData {
  totalProjects: number;
  totalReviews: number;
  totalComments: number;
  totalReplies: number;
  totalReviewLikes: number;
  totalCommentLikes: number;
  totalReplyLikes: number;
  platformRevenue: number; // In ALGO
  totalUserEarnings: number; // In ALGO (sum of all userEarnings)
  totalWritersCount: number; // NEW
  totalCuratorsCount: number; // NEW
  avgLikesPerReview: number; // NEW
  avgCommentsPerReview: number; // NEW
  avgRepliesPerComment: number; // NEW
  avgCuratorIndex: number; // NEW
  topWriters: UserAnalytics[];
  topCurators: UserAnalytics[];
  loading: boolean;
  error: string | null;
}

export function usePlatformAnalytics(projectsData: ProjectsData): PlatformAnalyticsData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the new useCuratorIndex hook to get all curator data
  const { allCuratorData, loading: curatorIndexLoading, error: curatorIndexError } = useCuratorIndex(undefined, projectsData);

  const analytics = useMemo(() => {
    if (!projectsData || curatorIndexLoading) {
      return {
        totalProjects: 0,
        totalReviews: 0, totalComments: 0, totalReplies: 0,
        totalReviewLikes: 0, totalCommentLikes: 0, totalReplyLikes: 0,
        platformRevenue: 0, totalUserEarnings: 0,
        totalWritersCount: 0,
        totalCuratorsCount: 0,
        avgLikesPerReview: 0, // NEW
        avgCommentsPerReview: 0, // NEW
        avgRepliesPerComment: 0, // NEW
        avgCuratorIndex: 0, // NEW
        topWriters: [], topCurators: [],
        loading: true, error: null,
      };
    }

    let numProjects = Object.keys(projectsData).length;
    let numReviews = 0;
    let numComments = 0;
    let numReplies = 0;
    let numReviewLikes = 0;
    let numCommentLikes = 0;
    let numReplyLikes = 0;

    const userEarningsMap = new Map<string, number>(); // address -> total earnings
    const userAmountSpentOnLikesMap = new Map<string, number>(); // address -> total ALGO spent on likes

    const initializeUserMaps = (address: string) => {
      if (!userEarningsMap.has(address)) {
        userEarningsMap.set(address, 0);
      }
      if (!userAmountSpentOnLikesMap.has(address)) {
        userAmountSpentOnLikesMap.set(address, 0);
      }
    };

    Object.values(projectsData).forEach(project => {
      Object.values(project.reviews || {}).forEach(review => { // Added || {}
        if (!(review.id.endsWith('.a') && review.content === "")) {
          numReviews++;
        }
        numReviewLikes += review.likeCount;

        initializeUserMaps(review.sender);
        // Calculate earnings for review creator
        userEarningsMap.set(review.sender, (userEarningsMap.get(review.sender) || 0) + (review.likeCount * LIKE_REVIEW_COST)); // Each like on their review: +1 ALGO
        userEarningsMap.set(review.sender, (userEarningsMap.get(review.sender) || 0) + (Object.values(review.comments || {}).length * 0.25)); // Each comment on their review: +0.25 ALGO // Added || {}

        // Calculate amount spent on likes for users who liked this review
        review.likeHistory.filter(event => event.action === 'LIKE').forEach(likeEvent => {
          const curatorAddress = likeEvent.sender;
          if (curatorAddress === review.sender) return; // Cannot like own content
          initializeUserMaps(curatorAddress);
          userAmountSpentOnLikesMap.set(curatorAddress, (userAmountSpentOnLikesMap.get(curatorAddress) || 0) + LIKE_REVIEW_COST);
        });

        Object.values(review.comments || {}).forEach(comment => { // Added || {}
          numComments++;
          numCommentLikes += comment.likeCount;

          initializeUserMaps(comment.sender);
          // Earnings from comments created by this user
          userEarningsMap.set(comment.sender, (userEarningsMap.get(comment.sender) || 0) + (Object.values(comment.replies || {}).length * 0.1)); // Each reply on their comment: +0.1 ALGO // Added || {}
          userEarningsMap.set(comment.sender, (userEarningsMap.get(comment.sender) || 0) + (comment.likeCount * 0.25)); // Each like on their comment: +0.25 ALGO

          // Earnings for review creator from likes on comments
          initializeUserMaps(review.sender);
          userEarningsMap.set(review.sender, (userEarningsMap.get(review.sender) || 0) + (comment.likeCount * 0.25)); // Each like on a comment on their review: +0.25 ALGO

          // Calculate amount spent on likes for users who liked this comment
          comment.likeHistory.filter(event => event.action === 'LIKE').forEach(likeEvent => {
            const curatorAddress = likeEvent.sender;
            if (curatorAddress === comment.sender) return; // Cannot like own content
            initializeUserMaps(curatorAddress);
            userAmountSpentOnLikesMap.set(curatorAddress, (userAmountSpentOnLikesMap.get(curatorAddress) || 0) + LIKE_COMMENT_COST);
          });

          Object.values(comment.replies || {}).forEach(reply => { // Added || {}
            numReplies++;
            numReplyLikes += reply.likeCount;

            initializeUserMaps(reply.sender);
            // Earnings from replies created by this user
            userEarningsMap.set(reply.sender, (userEarningsMap.get(reply.sender) || 0) + (reply.likeCount * 0.1)); // Each like on their reply: +0.1 ALGO

            // Earnings for comment creator from likes on replies
            initializeUserMaps(comment.sender);
            userEarningsMap.set(comment.sender, (userEarningsMap.get(comment.sender) || 0) + (reply.likeCount * 0.1)); // Each like on a reply on their comment: +0.1 ALGO

            // Earnings for review creator from likes on replies
            initializeUserMaps(review.sender);
            userEarningsMap.set(review.sender, (userEarningsMap.get(review.sender) || 0) + (reply.likeCount * 0.1)); // Each like on a reply on a comment on their review: +0.1 ALGO

            // Calculate amount spent on likes for users who liked this reply
            reply.likeHistory.filter(event => event.action === 'LIKE').forEach(likeEvent => {
              const curatorAddress = likeEvent.sender;
              if (curatorAddress === reply.sender) return; // Cannot like own content
              initializeUserMaps(curatorAddress);
              userAmountSpentOnLikesMap.set(curatorAddress, (userAmountSpentOnLikesMap.get(curatorAddress) || 0) + LIKE_REPLY_COST);
            });
          });
        });
      });
    });

    const platformRevenueReviews = numReviews * 1;
    const platformRevenueComments = numComments * 0.25;
    const platformRevenueReplies = numReplies * 0.1;
    const platformRevenue = platformRevenueReviews + platformRevenueComments + platformRevenueReplies;

    const totalUserEarnings = Array.from(userEarningsMap.values()).reduce((sum, earnings) => sum + earnings, 0);

    // Calculate overall curator index for each user using the data from useCuratorIndex
    const allUserAnalytics: UserAnalytics[] = [];
    const allActiveAddresses = new Set([...Array.from(userEarningsMap.keys()), ...Array.from(allCuratorData.keys())]);

    allActiveAddresses.forEach(address => {
      const curatorData = allCuratorData.get(address);
      const earnings = userEarningsMap.get(address) || 0;
      const amountSpent = userAmountSpentOnLikesMap.get(address) || 0;

      allUserAnalytics.push({
        address,
        totalEarnings: earnings,
        overallCuratorIndex: curatorData?.finalScore || 0,
        inactivityPenalty: curatorData?.d3 || 0.1, // D3 is the recency factor
        totalLikesGiven: curatorData?.totalLikesGiven || 0,
        amountSpentOnLikes: amountSpent,
      });
    });

    const topWriters = allUserAnalytics
      .filter(u => u.totalEarnings > 0)
      .sort((a, b) => b.totalEarnings - a.totalEarnings)
      .slice(0, 5);

    const topCurators = allUserAnalytics
      .filter(u => u.overallCuratorIndex > 0)
      .sort((a, b) => b.overallCuratorIndex - a.overallCuratorIndex)
      .slice(0, 5);
      
    // NEW: Calculate total counts
    const totalWritersCount = allUserAnalytics.filter(u => u.totalEarnings > 0).length;
    const totalCuratorsCount = allUserAnalytics.filter(u => u.overallCuratorIndex > 0).length;

    // NEW: Calculate engagement metrics
    const avgLikesPerReview = numReviews > 0 ? numReviewLikes / numReviews : 0;
    const avgCommentsPerReview = numReviews > 0 ? numComments / numReviews : 0;
    const avgRepliesPerComment = numComments > 0 ? numReplies / numComments : 0;

    let totalCuratorIndexSum = 0;
    allCuratorData.forEach(curator => {
      totalCuratorIndexSum += curator.finalScore;
    });
    const avgCuratorIndex = totalCuratorsCount > 0 ? totalCuratorIndexSum / totalCuratorsCount : 0;

    return {
      totalProjects: numProjects,
      totalReviews: numReviews,
      totalComments: numComments,
      totalReplies: numReplies,
      totalReviewLikes: numReviewLikes,
      totalCommentLikes: numCommentLikes,
      totalReplyLikes: numReplyLikes,
      platformRevenue,
      totalUserEarnings,
      totalWritersCount, // NEW
      totalCuratorsCount, // NEW
      avgLikesPerReview, // NEW
      avgCommentsPerReview, // NEW
      avgRepliesPerComment, // NEW
      avgCuratorIndex, // NEW
      topWriters,
      topCurators,
      loading: false,
      error: null,
    };
  }, [projectsData, allCuratorData, curatorIndexLoading]);

  useEffect(() => {
    setLoading(analytics.loading || curatorIndexLoading);
    setError(analytics.error || curatorIndexError);
  }, [analytics, curatorIndexLoading, curatorIndexError]);

  return { ...analytics, loading, error };
}