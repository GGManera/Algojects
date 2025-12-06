import { useState, useEffect } from 'react';

interface NfdApiResponse {
  [address: string]: {
    name: string;
    properties: {
      userDefined?: {
        bio?: string;
        blueskydid?: string;
        [key: string]: any;
      };
      verified?: {
        avatar?: string;
        banner?: string;
        discord?: string;
        twitter?: string;
        [key: string]: any;
      };
    };
  };
}

export interface NfdProcessedData {
  name: string | null;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  twitter: string | null;
  discord: string | null;
  blueskydid: string | null;
  verified: {
    avatar?: string;
    banner?: string;
    discord?: string;
    twitter?: string;
    [key: string]: any;
  } | null;
}

const nfdCache = new Map<string, NfdProcessedData>();

// Helper function to resolve image URLs from IPFS or direct links
const resolveImageUrl = async (url: string | undefined | null): Promise<string | null> => {
  if (!url) {
    return null;
  }

  // If it's an IPFS URL, resolve it
  if (url.startsWith('ipfs://')) {
    const ipfsPath = url.substring(7);
    const gatewayUrl = `https://ipfs-pera.algonode.dev/ipfs/${ipfsPath}`;
    
    try {
      // Fetch to see if it's metadata or a direct image
      const response = await fetch(gatewayUrl);
      if (!response.ok) {
        // If fetch fails, return the gateway URL as a fallback
        return gatewayUrl;
      }

      const contentType = response.headers.get("content-type");
      // If it's a JSON file, it's metadata
      if (contentType && contentType.includes("application/json")) {
        const metadata = await response.json();
        if (metadata.image && typeof metadata.image === 'string') {
          // The image URL in metadata could also be IPFS, so resolve it
          if (metadata.image.startsWith('ipfs://')) {
            return `https://ipfs-pera.algonode.dev/ipfs/${metadata.image.substring(7)}`;
          }
          // Otherwise, it's a direct URL
          return metadata.image;
        }
      }
      
      // If not JSON or no image property, assume the original URL was for the image itself
      return gatewayUrl;
    } catch (error) {
      console.error(`Failed to resolve IPFS URL ${url}:`, error);
      // Fallback to the gateway URL on error
      return gatewayUrl;
    }
  }

  // If it's a regular URL, return it as is
  return url;
};

export function useNfd(address: string | null | undefined) {
  const [nfd, setNfd] = useState<NfdProcessedData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setNfd(null);
      setLoading(false);
      return;
    }

    if (nfdCache.has(address)) {
      setNfd(nfdCache.get(address)!);
      setLoading(false);
      return;
    }

    const fetchNfd = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`https://api.nf.domains/nfd/lookup?address=${address}&view=full`);
        if (!response.ok) {
          if (response.status === 404) {
            setNfd(null);
            return;
          }
          throw new Error('Failed to fetch NFD data');
        }
        const data: NfdApiResponse = await response.json();
        
        const nfdData = data[address];

        if (nfdData) {
          const [finalAvatarUrl, finalBannerUrl] = await Promise.all([
            resolveImageUrl(nfdData.properties?.verified?.avatar),
            resolveImageUrl(nfdData.properties?.verified?.banner)
          ]);

          const processedData: NfdProcessedData = {
            name: nfdData.name,
            avatar: finalAvatarUrl,
            banner: finalBannerUrl,
            bio: nfdData.properties?.userDefined?.bio || null,
            twitter: nfdData.properties?.verified?.twitter || null,
            discord: nfdData.properties?.verified?.discord || null,
            blueskydid: nfdData.properties?.userDefined?.blueskydid || null,
            verified: nfdData.properties?.verified || null,
          };
          nfdCache.set(address, processedData);
          setNfd(processedData);
        } else {
          setNfd(null);
        }
      } catch (e: any) {
        setError(e.message);
        setNfd(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNfd();
  }, [address]);

  return { nfd, loading, error };
}