import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ProjectMetadata, MetadataItem } from '@/types/project'; // Import ProjectMetadata and MetadataItem
import { BaseInteraction } from '@/types/social'; // Import BaseInteraction
import { AllCuratorCalculationsMap } from '@/hooks/useCuratorIndex'; // Import AllCuratorCalculationsMap

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp: number): string {
  const now = new Date();
  const postDate = new Date(timestamp * 1000);
  const diffMs = now.getTime() - postDate.getTime();
  
  const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

  if (diffMs < twentyFourHoursInMs) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) {
      return `Just now`;
    }

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;

    if (remainingMinutes > 0) {
      return `${diffHours}h${remainingMinutes} ago`;
    } else {
      return `${diffHours}h ago`;
    }
  } else {
    return postDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

// NEW: Utility function to format large numbers with abbreviations
export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000_000) {
    return (num / 1_000_000_000_000).toFixed(1) + 'T';
  }
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

// NEW: Utility function to parse project metadata JSON string into ProjectMetadata array
export const parseProjectMetadata = (metadataJsonString: string): ProjectMetadata => {
  try {
    const parsed = JSON.parse(metadataJsonString);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        title: item.title || '',
        value: item.value || '',
        type: item.type || undefined,
      }));
    }
  } catch (e) {
    console.warn("Failed to parse project metadata JSON:", e);
  }
  return []; // Return empty array on parse error or if not an array
};

// NEW: Utility function to extract domain from a URL
export const extractDomainFromUrl = (url: string): string => {
  try {
    const hostname = new URL(url).hostname;
    // Remove 'www.' prefix if present
    return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
  } catch (e) {
    return url; // Return original URL if parsing fails
  }
};

// NEW: Utility function to extract X (Twitter) handle from a URL
export const extractXHandleFromUrl = (url: string): string => {
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0) {
      return `@${parts[0]}`;
    }
    return url; // Return original URL if parsing fails
  } catch (e) {
    return url; // Return original URL if parsing fails
  }
};

// NEW: Utility function to calculate the Curator-Weighted Like Score
export const getCuratorWeightedLikeScore = (
  item: BaseInteraction,
  allCuratorData: AllCuratorCalculationsMap
): number => {
  let totalWeightedScore = 0;
  item.likeHistory.forEach(likeEvent => {
    if (likeEvent.action === 'LIKE') {
      const curatorData = allCuratorData.get(likeEvent.sender);
      if (curatorData) {
        totalWeightedScore += curatorData.finalScore;
      }
    }
  });
  return totalWeightedScore;
};