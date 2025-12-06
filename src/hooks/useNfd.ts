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

const resolveIpfsUrl = (url: string): string => {
  if (url.startsWith('ipfs://')) {
    return `https://ipfs-pera.algonode.dev/ipfs/${url.substring(7)}`;
  }
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
          let finalBannerUrl: string | null = null;
          const initialBanner = nfdData.properties?.verified?.banner;

          if (initialBanner) {
            if (initialBanner.startsWith('ipfs://')) {
              try {
                const metadataUrl = resolveIpfsUrl(initialBanner);
                const metadataResponse = await fetch(metadataUrl);
                if (metadataResponse.ok) {
                  const metadataJson = await metadataResponse.json();
                  if (metadataJson.image && typeof metadataJson.image === 'string') {
                    // The image property itself might be an IPFS URL, so resolve it too
                    finalBannerUrl = resolveIpfsUrl(metadataJson.image);
                  }
                  // If metadata doesn't have an image, finalBannerUrl remains null
                }
                // If metadata fetch fails, finalBannerUrl remains null
              } catch (e) {
                console.error("Failed to fetch or parse banner metadata:", e);
                // If any error, finalBannerUrl remains null
              }
            } else {
              // Assume it's a direct URL if not starting with ipfs://
              finalBannerUrl = initialBanner;
            }
          }

          const processedData: NfdProcessedData = {
            name: nfdData.name,
            avatar: nfdData.properties?.verified?.avatar ? resolveIpfsUrl(nfdData.properties.verified.avatar) : null,
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