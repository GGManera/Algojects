"use client";

import { useState, useEffect, useMemo } from 'react';
import { ProjectsData, Review, Comment, Reply } from '@/types/social';
import {
  useCuratorIndex, // Import the new useCuratorIndex hook
  CuratorIndexData, // Import CuratorIndexData interface
  AllCuratorCalculationsMap // Import the map of all curator calculations
} from './useCuratorIndex'; // Import constants and interface from useCuratorIndex
import { AllWriterDiversityMap } from './useWritingDiversity'; // NEW: Import AllWriterDiversityMap

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
  // NEW Diversity Metrics
  uniqueProjectsWrittenIn: number;
  uniqueWritersInteractedWith: number;
  diversityScore: number; // Combined score for ranking
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
  topWriters: UserAnalytics[];
  topCurators: UserAnalytics[];
  topDiversityWriters: UserAnalytics[]; // NEW: Top writers ranked by diversity
  loading: boolean;
  error: string | null;
}

// NEW: Define weights for diversity score calculation
const PROJECT_DIVERSITY_WEIGHT = 0.6;
const WRITER_INTERACTION_WEIGHT = 0.4;

export function usePlatformAnalytics(projectsData: ProjectsData, allWriterDiversity: AllWriterDiversityMap): PlatformAnalyticsData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the new useCuratorIndex hook to get all curator data
  const { allCuratorData, loading: curatorIndexLoading, error: curatorIndexError } = useCuratorIndex(undefined, projectsData);

  const analytics = useMemo(() => {
    if (!projectsData || curatorIndexLoading || allWriterDiversity.size === 0) {
      return {
        totalProjects: 0,
        totalReviews: 0, totalComments: 0, totalReplies: 0,
        totalReviewLikes: 0, totalCommentLikes: 0, totalReplyLikes: 0,
        platformRevenue: 0, totalUserEarnings: 0,
        totalWritersCount: 0,
        totalCuratorsCount: 0,
        topWriters: [], topCurators: [], topDiversityWriters: [],
        loading: true, error: null,
      };
    }

    const numProjects = Object.keys(projectsData).length;
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

    // --- Combine all user data and calculate diversity score ---
    const allActiveAddresses = new Set([...Array.from(userEarningsMap.keys()), ...Array.from(allCuratorData.keys()), ...Array.from(allWriterDiversity.keys())]);

    const allUserAnalytics: UserAnalytics[] = [];
    
    // Find max diversity values for normalization (used in diversity score calculation)
    let maxProjectsWrittenIn = 0;
    let maxWritersInteractedWith = 0;
    allWriterDiversity.forEach(metrics => {
        if (metrics.uniqueProjectsWrittenIn > maxProjectsWrittenIn) maxProjectsWrittenIn = metrics.uniqueProjectsWrittenIn;
        if (metrics.uniqueWritersInteractedWith > maxWritersInteractedWith) maxWritersInteractedWith = metrics.uniqueWritersInteractedWith;
    });
    
    // Handle zero division case
    if (maxProjectsWrittenIn === 0) maxProjectsWrittenIn = 1;
    if (maxWritersInteractedWith === 0) maxWritersInteractedWith = 1;


    allActiveAddresses.forEach(address => {
      const curatorData = allCuratorData.get(address);
      const diversityData = allWriterDiversity.get(address);
      const earnings = userEarningsMap.get(address) || 0;
      const amountSpent = userAmountSpentOnLikesMap.get(address) || 0;
      
      const projectsWrittenIn = diversityData?.uniqueProjectsWrittenIn || 0;
      const writersInteractedWith = diversityData?.uniqueWritersInteractedWith || 0;
      
      // Normalize and calculate Diversity Score (0 to 100)
      const normalizedProjects = projectsWrittenIn / maxProjectsWrittenIn;
      const normalizedWriters = writersInteractedWith / maxWritersInteractedWith;
      
      const diversityScore = (
          normalizedProjects * PROJECT_DIVERSITY_WEIGHT + 
          normalizedWriters * WRITER_INTERACTION_WEIGHT
      ) * 100;


      allUserAnalytics.push({
        address,
        totalEarnings: earnings,
        overallCuratorIndex: curatorData?.finalScore || 0,
        inactivityPenalty: curatorData?.d3 || 0.1, // D3 is the recency factor
        totalLikesGiven: curatorData?.totalLikesGiven || 0,
        amountSpentOnLikes: amountSpent,
        uniqueProjectsWrittenIn: projectsWrittenIn,
        uniqueWritersInteractedWith: writersInteractedWith,
        diversityScore: diversityScore,
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
      
    // NEW: Top Diversity Writers (ranked by diversityScore)
    const topDiversityWriters = allUserAnalytics
      .filter(u => u.diversityScore > 0)
      .sort((a, b) => b.diversityScore - a.diversityScore)
      .slice(0, 5);
      
    // NEW: Calculate total counts
    const totalWritersCount = allUserAnalytics.filter(u => u.totalEarnings > 0).length;
    const totalCuratorsCount = allUserAnalytics.filter(u => u.overallCuratorIndex > 0).length;

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
      totalWritersCount,
      totalCuratorsCount,
      topWriters,
      topCurators,
      topDiversityWriters, // NEW
      loading: false,
      error: null,
    };
  }, [projectsData, allCuratorData, allWriterDiversity, curatorIndexLoading]);

  useEffect(() => {
    setLoading(analytics.loading || curatorIndexLoading);
    setError(analytics.error || curatorIndexError);
  }, [analytics, curatorIndexLoading, curatorIndexError]);

  return { ...analytics, loading, error };
}