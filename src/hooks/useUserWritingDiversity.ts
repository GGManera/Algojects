"use client";

import { useState, useEffect, useMemo } from 'react';
import { ProjectsData, Review, Comment, Reply } from '@/types/social';

export interface UserWritingDiversityData {
  uniqueProjectsWrittenIn: number;
  uniqueWritersInteractedWith: number;
  loading: boolean;
}

export function useUserWritingDiversity(userAddress: string | undefined, projectsData: ProjectsData): UserWritingDiversityData {
  const [loading, setLoading] = useState(true);

  const diversityData = useMemo(() => {
    if (!userAddress || !projectsData || Object.keys(projectsData).length === 0) {
      setLoading(false);
      return { uniqueProjectsWrittenIn: 0, uniqueWritersInteractedWith: 0 };
    }

    setLoading(true);
    const projectsSet = new Set<string>();
    const writersSet = new Set<string>();

    Object.values(projectsData).forEach(project => {
      Object.values(project.reviews || {}).forEach(review => {
        
        // Check if user wrote the review
        if (review.sender === userAddress) {
          projectsSet.add(project.id);
        }

        Object.values(review.comments || {}).forEach(comment => {
          
          // Check if user wrote the comment
          if (comment.sender === userAddress) {
            projectsSet.add(project.id);
            // The writer of the review is the person the user interacted with
            if (review.sender !== userAddress) {
                writersSet.add(review.sender);
            }
          }

          Object.values(comment.replies || {}).forEach(reply => {
            
            // Check if user wrote the reply
            if (reply.sender === userAddress) {
              projectsSet.add(project.id);
              // The writer of the comment is the person the user interacted with
              if (comment.sender !== userAddress) {
                writersSet.add(comment.sender);
              }
            }
          });
        });
      });
    });

    setLoading(false);
    return {
      uniqueProjectsWrittenIn: projectsSet.size,
      uniqueWritersInteractedWith: writersSet.size,
    };
  }, [userAddress, projectsData]);

  return { ...diversityData, loading };
}