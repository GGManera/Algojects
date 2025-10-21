"use client";

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ProjectsData } from '@/types/social';
import { ProjectDetailsEntry } from '../../api/project-details';
import { fetchAssetBalanceAtRound } from '@/lib/allo'; // UPDATED IMPORT
import { ProjectMetadata } from '@/types/project';

export interface UserProjectTokenHolding {
  projectId: string;
  projectName: string;
  assetId: number;
  amount: number;
  assetUnitName: string;
}

// Renamed hook to reflect its purpose (used only on UserProfile page)
export function useProfileProjectTokenHoldings(
  userAddress: string | undefined,
  projectsData: ProjectsData,
  projectDetails: ProjectDetailsEntry[],
  round: number | undefined
) {
  const [tokenHoldings, setTokenHoldings] = useState<UserProjectTokenHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  // Fallback round for testing if the actual round is missing
  const effectiveRound = round || 30000000;
  const isProfilePage = location.pathname.startsWith('/profile/'); // Check if we are on the profile page

  const relevantProjectAssetIds = useMemo(() => {
    const projectAssetMap = new Map<string, { assetId: number; projectName: string; assetUnitName: string }>();
    
    // Only calculate if we are on the profile page and have an address
    if (!userAddress || !projectsData || !projectDetails.length || !isProfilePage) {
      return projectAssetMap;
    }

    const userInteractedProjectIds = new Set<string>();

    Object.values(projectsData).forEach(project => {
      Object.values(project.reviews || {}).forEach(review => {
        if (review.sender === userAddress) userInteractedProjectIds.add(project.id);
        Object.values(review.comments || {}).forEach(comment => {
          if (comment.sender === userAddress) userInteractedProjectIds.add(project.id);
          Object.values(comment.replies || {}).forEach(reply => {
            if (reply.sender === userAddress) userInteractedProjectIds.add(project.id);
          });
        });
      });
    });

    userInteractedProjectIds.forEach(projectId => {
      const details = projectDetails.find(pd => pd.projectId === projectId);
      if (details && details.projectMetadata) {
        const assetIdItem = details.projectMetadata.find(item => item.type === 'asset-id' || (!isNaN(parseInt(item.value)) && parseInt(item.value) > 0));
        const projectNameItem = details.projectMetadata.find(item => item.type === 'project-name');
        const assetUnitNameItem = details.projectMetadata.find(item => item.type === 'asset-unit-name');

        if (assetIdItem?.value && projectNameItem?.value) {
          const assetIdNum = parseInt(assetIdItem.value, 10);
          if (!isNaN(assetIdNum) && assetIdNum > 0) {
            projectAssetMap.set(projectId, { 
              assetId: assetIdNum, 
              projectName: projectNameItem.value,
              assetUnitName: assetUnitNameItem?.value || ''
            });
          }
        }
      }
    });

    return projectAssetMap;
  }, [userAddress, projectsData, projectDetails, isProfilePage]);

  useEffect(() => {
    console.log(`[useProfileProjectTokenHoldings] Check: userAddress=${userAddress}, effectiveRound=${effectiveRound}, isProfilePage=${isProfilePage}, relevantAssets=${relevantProjectAssetIds.size}`);

    if (!userAddress || !effectiveRound || !isProfilePage || relevantProjectAssetIds.size === 0) {
      setTokenHoldings([]);
      setLoading(false);
      return;
    }

    const fetchHoldings = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`[useProfileProjectTokenHoldings] Initiating fetchAssetBalanceAtRound for ${relevantProjectAssetIds.size} assets for user ${userAddress} at round ${effectiveRound}`);
        
        const fetchPromises: Promise<UserProjectTokenHolding>[] = [];

        relevantProjectAssetIds.forEach((projectAssetInfo, projectId) => {
          fetchPromises.push(
            fetchAssetBalanceAtRound(userAddress, projectAssetInfo.assetId, effectiveRound)
              .then(balanceData => ({
                projectId,
                projectName: projectAssetInfo.projectName,
                assetId: projectAssetInfo.assetId,
                amount: balanceData.amount,
                assetUnitName: balanceData.unitName || projectAssetInfo.assetUnitName, // Use unitName from Allo if available, fallback to Coda
              }))
              .catch(err => {
                console.error(`Failed to fetch balance for asset ${projectAssetInfo.assetId}:`, err);
                return {
                  projectId,
                  projectName: projectAssetInfo.projectName,
                  assetId: projectAssetInfo.assetId,
                  amount: 0,
                  assetUnitName: projectAssetInfo.assetUnitName,
                };
              })
          );
        });

        const results = await Promise.all(fetchPromises);
        setTokenHoldings(results.filter(r => r.amount > 0)); // Only show holdings > 0
      } catch (err) {
        console.error("Error fetching user project token holdings:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchHoldings();
  }, [userAddress, relevantProjectAssetIds, isProfilePage, effectiveRound]);

  return { tokenHoldings, loading, error };
}