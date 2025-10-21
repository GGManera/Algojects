"use client";

import { useState, useEffect, useMemo } from 'react';
import { ProjectsData } from '@/types/social';
import { ProjectDetailsEntry } from '../../api/project-details';
import { fetchAccountAssetHoldings } from '@/utils/algorand';
import { ProjectMetadata } from '@/types/project'; // Import ProjectMetadata

export interface UserProjectTokenHolding {
  projectId: string;
  projectName: string;
  assetId: number;
  amount: number;
  assetUnitName: string; // NEW: Add assetUnitName
}

export function useUserProjectTokenHoldings(
  userAddress: string | undefined,
  projectsData: ProjectsData,
  projectDetails: ProjectDetailsEntry[]
) {
  const [tokenHoldings, setTokenHoldings] = useState<UserProjectTokenHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const relevantProjectAssetIds = useMemo(() => {
    const projectAssetMap = new Map<string, { assetId: number; projectName: string; assetUnitName: string }>();
    if (!userAddress || !projectsData || !projectDetails.length) {
      return projectAssetMap;
    }

    const userInteractedProjectIds = new Set<string>();

    // Identify projects where the user has written content
    Object.values(projectsData).forEach(project => {
      Object.values(project.reviews || {}).forEach(review => { // ADDED || {}
        if (review.sender === userAddress) {
          userInteractedProjectIds.add(project.id);
        }
        Object.values(review.comments || {}).forEach(comment => { // ADDED || {}
          if (comment.sender === userAddress) {
            userInteractedProjectIds.add(project.id);
          }
          Object.values(comment.replies || {}).forEach(reply => { // ADDED || {}
            if (reply.sender === userAddress) {
              userInteractedProjectIds.add(project.id);
            }
          });
        });
      });
    });

    // For each interacted project, find its asset ID and name from projectDetails
    userInteractedProjectIds.forEach(projectId => {
      const details = projectDetails.find(pd => pd.projectId === projectId);
      if (details && details.projectMetadata) {
        const assetIdItem = details.projectMetadata.find(item => item.type === 'asset-id' || (!isNaN(parseInt(item.value)) && parseInt(item.value) > 0));
        const projectNameItem = details.projectMetadata.find(item => item.type === 'project-name');
        const assetUnitNameItem = details.projectMetadata.find(item => item.type === 'asset-unit-name'); // NEW: Get asset unit name

        if (assetIdItem?.value && projectNameItem?.value) {
          const assetIdNum = parseInt(assetIdItem.value, 10);
          if (!isNaN(assetIdNum) && assetIdNum > 0) {
            projectAssetMap.set(projectId, { 
              assetId: assetIdNum, 
              projectName: projectNameItem.value,
              assetUnitName: assetUnitNameItem?.value || '' // Use found unit name or empty string
            });
          }
        }
      }
    });

    return projectAssetMap;
  }, [userAddress, projectsData, projectDetails]);

  useEffect(() => {
    if (!userAddress || relevantProjectAssetIds.size === 0) {
      setTokenHoldings([]);
      setLoading(false);
      return;
    }

    const fetchHoldings = async () => {
      setLoading(true);
      setError(null);
      try {
        const assetIdsToFetch = Array.from(relevantProjectAssetIds.values()).map(item => item.assetId);
        const holdingsMap = await fetchAccountAssetHoldings(userAddress, assetIdsToFetch);

        const results: UserProjectTokenHolding[] = [];
        relevantProjectAssetIds.forEach((projectAssetInfo, projectId) => {
          const amount = holdingsMap.get(projectAssetInfo.assetId) || 0;
          results.push({
            projectId,
            projectName: projectAssetInfo.projectName,
            assetId: projectAssetInfo.assetId,
            amount,
            assetUnitName: projectAssetInfo.assetUnitName, // Include assetUnitName
          });
        });
        setTokenHoldings(results);
      } catch (err) {
        console.error("Error fetching user project token holdings:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchHoldings();
  }, [userAddress, relevantProjectAssetIds]);

  return { tokenHoldings, loading, error };
}