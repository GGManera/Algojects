"use client";

import { useState, useEffect, useMemo } from 'react';
import { ProjectsData, Review, Comment, Reply } from '@/types/social';

// Constants for D3 (Recência de Atividade)
const D3_ACTIVE_DAYS = 10; // Days for D3 = 1
const D3_INACTIVE_DAYS = 90; // Days for D3 = 0.1
const D3_RANGE_DAYS = D3_INACTIVE_DAYS - D3_ACTIVE_DAYS; // 80 days

// NEW: Weights for mitigation factors
const D1_WEIGHT = 10;
const D2_WEIGHT = 5;
const D3_WEIGHT = 1;
const TOTAL_MITIGATION_WEIGHT = D1_WEIGHT + D2_WEIGHT + D3_WEIGHT; // 10 + 5 + 1 = 16

export interface CuratorIndexData {
  overallIndex: number; // This will be ScoreFinalCurador
  a1Score: number;
  a2Score: number;
  mitigationFactor: number; // This will be M
  d1DiversityWriters: number;
  d2DiversityProjects: number;
  d3Recency: number;
  totalLikesGiven: number;
  loading: boolean;
  error: string | null;
}

// Internal structure to hold all calculated data for each curator
interface CuratorCalculations {
  address: string;
  lastLikeTimestamp: number | null;
  uniqueWritersLiked: Set<string>;
  uniqueProjectsLiked: Set<string>;
  allLocalScoresA1: number[]; // Store all ScoreLocal values for A1 calculation
  allLocalScoresA2: number[]; // Store all ScoreLocal2 values for A2 calculation
  totalLikesGiven: number;
  a1: number; // Average of allLocalScoresA1
  a2: number; // Average of allLocalScoresA2
  d1: number;
  d2: number;
  d3: number;
  m: number;
  finalScore: number; // A2 * M
}

// Helper to extract item type from ID
const getItemTypeFromId = (itemId: string): 'review' | 'comment' | 'reply' => {
  const parts = itemId.split('.');
  if (parts.length === 2) return 'review';
  if (parts.length === 3) return 'comment';
  return 'reply';
};

// NEW: Exported interface for the full map of curator calculations
export interface AllCuratorCalculationsMap extends Map<string, CuratorCalculations> {}

// NEW: Updated return type for useCuratorIndex
interface UseCuratorIndexReturn {
  userCuratorData: CuratorIndexData;
  allCuratorData: AllCuratorCalculationsMap; // Export the full map
  loading: boolean;
  error: string | null;
}

export function useCuratorIndex(userAddress: string | undefined, projectsData: ProjectsData): UseCuratorIndexReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allCuratorData = useMemo(() => {
    setLoading(true);
    setError(null);

    if (!projectsData || Object.keys(projectsData).length === 0) {
      setLoading(false);
      return new Map<string, CuratorCalculations>();
    }

    const curatorsMap = new Map<string, CuratorCalculations>(); // address -> CuratorCalculations
    const likesByItem = new Map<string, Array<{ sender: string; timestamp: number; action: 'LIKE' | 'UNLIKE'; txId: string }>>();
    const writerAddressesByItem = new Map<string, string>(); // itemId -> writerAddress
    const projectIdsByItem = new Map<string, string>(); // itemId -> projectId

    // --- Phase 0: Collect all raw like events and initialize curator data ---
    Object.values(projectsData).forEach(project => {
      Object.values(project.reviews || {}).forEach(review => { // Added || {}
        // Store writer and project ID for reviews
        writerAddressesByItem.set(review.id, review.sender);
        projectIdsByItem.set(review.id, project.id);
        likesByItem.set(review.id, review.likeHistory);

        Object.values(review.comments || {}).forEach(comment => { // Added || {}
          // Store writer and project ID for comments
          writerAddressesByItem.set(comment.id, comment.sender);
          projectIdsByItem.set(comment.id, project.id);
          likesByItem.set(comment.id, comment.likeHistory);

          Object.values(comment.replies || {}).forEach(reply => { // Added || {}
            // Store writer and project ID for replies
            writerAddressesByItem.set(reply.id, reply.sender);
            projectIdsByItem.set(reply.id, project.id);
            likesByItem.set(reply.id, reply.likeHistory);
          });
        });
      });
    });

    // Initialize curatorsMap and collect initial activity data
    likesByItem.forEach((likeHistory, itemId) => {
      const writerAddress = writerAddressesByItem.get(itemId);
      const projectId = projectIdsByItem.get(itemId);

      likeHistory.filter(l => l.action === 'LIKE').forEach(like => {
        const curatorAddress = like.sender;
        if (curatorAddress === writerAddress) return; // Curators cannot like their own content

        if (!curatorsMap.has(curatorAddress)) {
          curatorsMap.set(curatorAddress, {
            address: curatorAddress,
            lastLikeTimestamp: null,
            uniqueWritersLiked: new Set(),
            uniqueProjectsLiked: new Set(),
            allLocalScoresA1: [],
            allLocalScoresA2: [],
            totalLikesGiven: 0,
            a1: 0, a2: 0, d1: 0, d2: 0, d3: 0, m: 0, finalScore: 0,
          });
        }
        const curator = curatorsMap.get(curatorAddress)!;

        // Update last like timestamp
        if (curator.lastLikeTimestamp === null || like.timestamp > curator.lastLikeTimestamp) {
          curator.lastLikeTimestamp = like.timestamp;
        }

        // Update unique writers liked
        if (writerAddress) {
          curator.uniqueWritersLiked.add(writerAddress);
        }

        // Update unique projects liked
        if (projectId) {
          curator.uniqueProjectsLiked.add(projectId);
        }
        curator.totalLikesGiven++;
      });
    });

    // --- Phase 1: Calculate A1 for all curators ---
    curatorsMap.forEach(curator => {
      likesByItem.forEach((likeHistory, itemId) => {
        const itemLikes = likeHistory.filter(l => l.action === 'LIKE');
        const L = itemLikes.length;
        if (L === 0) return;

        itemLikes.forEach((like, index) => {
          if (like.sender === curator.address) {
            const PosiçãoDoLike = index + 1;
            const ScoreLocal = (L - PosiçãoDoLike) + 1;
            curator.allLocalScoresA1.push(ScoreLocal);
          }
        });
      });
      curator.a1 = curator.allLocalScoresA1.length > 0
        ? curator.allLocalScoresA1.reduce((sum, score) => sum + score, 0) / curator.allLocalScoresA1.length
        : 0;
    });

    // --- Phase 2: Calculate A2 for all curators ---
    const postScoresSP = new Map<string, number>(); // itemId -> SP

    // Calculate SP for each post
    likesByItem.forEach((likeHistory, itemId) => {
      const itemLikes = likeHistory.filter(l => l.action === 'LIKE');
      let SP = 0;
      itemLikes.forEach(like => {
        const curator = curatorsMap.get(like.sender);
        if (curator) {
          SP += curator.a1;
        }
      });
      postScoresSP.set(itemId, SP);
    });

    // Calculate A2 for each curator
    curatorsMap.forEach(curator => {
      likesByItem.forEach((likeHistory, itemId) => {
        const itemLikes = likeHistory.filter(l => l.action === 'LIKE');
        const L = itemLikes.length;
        const SP = postScoresSP.get(itemId) || 0;
        if (L === 0 || SP === 0) return;

        itemLikes.forEach((like, index) => {
          if (like.sender === curator.address) {
            const PosiçãoDoLike = index + 1;
            const ScoreLocal2 = SP * ((L - PosiçãoDoLike) + 1);
            curator.allLocalScoresA2.push(ScoreLocal2);
          }
        });
      });
      curator.a2 = curator.allLocalScoresA2.length > 0
        ? curator.allLocalScoresA2.reduce((sum, score) => sum + score, 0) / curator.allLocalScoresA2.length
        : 0;
    });

    // --- Phase 3: Calculate Mitigation (M) factors (D1, D2, D3) ---

    // D1: Diversidade de Carteiras
    let minUniqueWriters = Infinity;
    let maxUniqueWriters = 0;
    curatorsMap.forEach(curator => {
      const count = curator.uniqueWritersLiked.size;
      if (count < minUniqueWriters) minUniqueWriters = count;
      if (count > maxUniqueWriters) maxUniqueWriters = count;
    });

    // Handle edge case where all curators liked the same number of writers
    if (minUniqueWriters === Infinity) minUniqueWriters = 0; // No curators or no likes
    if (maxUniqueWriters === 0 && minUniqueWriters === 0) { // No curators or no likes
      minUniqueWriters = 1; // Avoid division by zero, treat as if everyone liked 1 writer
      maxUniqueWriters = 1;
    } else if (maxUniqueWriters === minUniqueWriters) { // All liked same number of writers
      if (maxUniqueWriters === 1) { // All liked only 1 writer
        minUniqueWriters = 1;
        maxUniqueWriters = 1;
      } else { // All liked > 1 writer, but same number
        minUniqueWriters = maxUniqueWriters - 1; // Create a small range for calculation
      }
    }

    curatorsMap.forEach(curator => {
      const curatorUniqueWriters = curator.uniqueWritersLiked.size;
      if (maxUniqueWriters === minUniqueWriters) {
        curator.d1 = (curatorUniqueWriters > 1) ? 1 : 0.1;
      } else {
        curator.d1 = 0.1 + (0.9 * (curatorUniqueWriters - minUniqueWriters) / (maxUniqueWriters - minUniqueWriters));
      }
      curator.d1 = Math.max(0.1, Math.min(1, curator.d1)); // Ensure bounds
    });

    // D2: Diversidade de Projetos
    let minUniqueProjects = Infinity;
    let maxUniqueProjects = 0;
    curatorsMap.forEach(curator => {
      const count = curator.uniqueProjectsLiked.size;
      if (count < minUniqueProjects) minUniqueProjects = count;
      if (count > maxUniqueProjects) maxUniqueProjects = count;
    });

    // Handle edge case where all curators liked the same number of projects
    if (minUniqueProjects === Infinity) minUniqueProjects = 0; // No curators or no likes
    if (maxUniqueProjects === 0 && minUniqueProjects === 0) { // No curators or no likes
      minUniqueProjects = 1; // Avoid division by zero, treat as if everyone liked 1 project
      maxUniqueProjects = 1;
    } else if (maxUniqueProjects === minUniqueProjects) { // All liked same number of projects
      if (maxUniqueProjects === 1) { // All liked only 1 project
        minUniqueProjects = 1;
        maxUniqueProjects = 1;
      } else { // All liked > 1 project, but same number
        minUniqueProjects = maxUniqueProjects - 1; // Create a small range for calculation
      }
    }

    curatorsMap.forEach(curator => {
      const curatorUniqueProjects = curator.uniqueProjectsLiked.size;
      if (maxUniqueProjects === minUniqueProjects) {
        curator.d2 = (curatorUniqueProjects > 1) ? 1 : 0.1;
      } else {
        curator.d2 = 0.1 + (0.9 * (curatorUniqueProjects - minUniqueProjects) / (maxUniqueProjects - minUniqueProjects));
      }
      curator.d2 = Math.max(0.1, Math.min(1, curator.d2)); // Ensure bounds
    });

    // D3: Recência de Atividade
    const currentTimeSeconds = Date.now() / 1000;
    curatorsMap.forEach(curator => {
      if (curator.lastLikeTimestamp === null) {
        curator.d3 = 0.1; // Never liked, lowest activity
      } else {
        const daysSinceLastLike = (currentTimeSeconds - curator.lastLikeTimestamp) / (24 * 60 * 60);
        if (daysSinceLastLike <= D3_ACTIVE_DAYS) {
          curator.d3 = 1;
        } else if (daysSinceLastLike >= D3_INACTIVE_DAYS) {
          curator.d3 = 0.1;
        } else {
          curator.d3 = 1 - (0.9 * (daysSinceLastLike - D3_ACTIVE_DAYS) / D3_RANGE_DAYS);
        }
      }
      curator.d3 = Math.max(0.1, Math.min(1, curator.d3)); // Ensure bounds
    });

    // Calculate final M and ScoreFinalCurador
    curatorsMap.forEach(curator => {
      // NEW: Weighted average for M
      curator.m = (curator.d1 * D1_WEIGHT + curator.d2 * D2_WEIGHT + curator.d3 * D3_WEIGHT) / TOTAL_MITIGATION_WEIGHT;
      curator.m = Math.max(0.1, Math.min(1, curator.m)); // Ensure bounds for M
      curator.finalScore = curator.a2 * curator.m;
    });

    setLoading(false);
    return curatorsMap;
  }, [projectsData]);

  const userCuratorData = useMemo(() => {
    if (!userAddress) {
      return {
        overallIndex: 0, a1Score: 0, a2Score: 0, mitigationFactor: 0,
        d1DiversityWriters: 0, d2DiversityProjects: 0, d3Recency: 0,
        totalLikesGiven: 0, loading: false, error: null,
      };
    }
    const data = allCuratorData.get(userAddress);
    if (!data) {
      return {
        overallIndex: 0, a1Score: 0, a2Score: 0, mitigationFactor: 0,
        d1DiversityWriters: 0, d2DiversityProjects: 0, d3Recency: 0,
        totalLikesGiven: 0, loading: false, error: null,
      };
    }
    return {
      overallIndex: data.finalScore,
      a1Score: data.a1,
      a2Score: data.a2,
      mitigationFactor: data.m,
      d1DiversityWriters: data.d1,
      d2DiversityProjects: data.d2,
      d3Recency: data.d3,
      totalLikesGiven: data.totalLikesGiven,
      loading: false,
      error: null,
    };
  }, [userAddress, allCuratorData]);

  return { userCuratorData, allCuratorData, loading, error };
}