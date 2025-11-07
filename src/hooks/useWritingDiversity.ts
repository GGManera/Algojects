"use client";

import { useState, useEffect, useMemo } from 'react';
import { ProjectsData, Review, Comment, Reply } from '@/types/social';

export interface WriterDiversityMetrics {
  uniqueProjectsWrittenIn: number;
  uniqueWritersInteractedWith: number;
}

export interface AllWriterDiversityMap extends Map<string, WriterDiversityMetrics> {}

export interface UseWritingDiversityReturn {
  allWriterDiversity: AllWriterDiversityMap;
  loading: boolean;
}

export function useWritingDiversity(projectsData: ProjectsData): UseWritingDiversityReturn {
  const [loading, setLoading] = useState(true);

  const allWriterDiversity = useMemo(() => {
    setLoading(true);

    if (!projectsData || Object.keys(projectsData).length === 0) {
      setLoading(false);
      return new Map<string, WriterDiversityMetrics>();
    }

    const writerMetricsMap = new Map<string, { projects: Set<string>; writers: Set<string> }>();

    const initializeUser = (address: string) => {
      if (!writerMetricsMap.has(address)) {
        writerMetricsMap.set(address, { projects: new Set(), writers: new Set() });
      }
      return writerMetricsMap.get(address)!;
    };

    Object.values(projectsData).forEach(project => {
      Object.values(project.reviews || {}).forEach(review => {
        
        // 1. Review Writer Metrics
        const reviewWriter = initializeUser(review.sender);
        reviewWriter.projects.add(project.id);

        Object.values(review.comments || {}).forEach(comment => {
          
          // 2. Comment Writer Metrics
          const commentWriter = initializeUser(comment.sender);
          commentWriter.projects.add(project.id);
          
          // Comment writer interacts with the Review writer
          if (review.sender !== comment.sender) {
            commentWriter.writers.add(review.sender);
          }

          Object.values(comment.replies || {}).forEach(reply => {
            
            // 3. Reply Writer Metrics
            const replyWriter = initializeUser(reply.sender);
            replyWriter.projects.add(project.id);
            
            // Reply writer interacts with the Comment writer
            if (comment.sender !== reply.sender) {
              replyWriter.writers.add(comment.sender);
            }
          });
        });
      });
    });

    // Final conversion to the desired output format
    const finalMap: AllWriterDiversityMap = new Map();
    writerMetricsMap.forEach((metrics, address) => {
      finalMap.set(address, {
        uniqueProjectsWrittenIn: metrics.projects.size,
        uniqueWritersInteractedWith: metrics.writers.size,
      });
    });

    setLoading(false);
    return finalMap;
  }, [projectsData]);

  return { allWriterDiversity, loading };
}