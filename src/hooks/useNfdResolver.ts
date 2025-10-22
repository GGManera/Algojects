"use client";

import { useState, useEffect } from 'react';
import { queueNfdResolutionV2 } from './useNfdBatcher'; // NEW: Import the batcher

interface NfdData {
  name: string | null;
  avatar: string | null;
  address: string | null;
}

// Modified to store timestamp
export const nfdLookupCache = new Map<string, (NfdData & { timestamp: number }) | null>(); // EXPORTED

export const NFD_RESOLVER_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes for NFD resolver cache
const NFD_API_URL = "https://api.nf.domains";
const BATCH_SIZE = 20; // Max addresses per batch

export const ipfsToGateway = (url: string | undefined): string | null => {
  if (!url) return null;

  // If it's already a direct HTTP/HTTPS URL, use it as is.
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // If it's an IPFS URI, convert it to the Pera gateway.
  if (url.startsWith("ipfs://")) {
    const hash = url.substring("ipfs://".length);
    return `https://ipfs-pera.algonode.dev/ipfs/${hash}`;
  }

  // For any other format, return null
  return null;
};

export function useNfdResolver(inputs: string[] | undefined) {
  const [resolvedAddresses, setResolvedAddresses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[useNfdResolver] Inputs received:", inputs);

    if (!inputs || inputs.length === 0) {
      setResolvedAddresses(new Set());
      setLoading(false);
      return;
    }

    const fetchResolutions = async () => {
      setLoading(true);
      const newResolvedAddresses = new Set<string>();
      const addressesToQueue: string[] = [];
      const nameLookups: string[] = [];

      // --- Phase 1: Check cache and categorize inputs ---
      for (const input of inputs) {
        const trimmedInput = input.trim();
        if (!trimmedInput) continue;

        const cachedEntry = nfdLookupCache.get(trimmedInput);
        const isFresh = cachedEntry && (Date.now() - cachedEntry.timestamp < NFD_RESOLVER_CACHE_DURATION_MS);

        if (isFresh) {
          if (cachedEntry?.address) {
            newResolvedAddresses.add(cachedEntry.address);
          }
          continue;
        }

        // If stale or missing, determine type and add to fetch list
        if (trimmedInput.length === 58) {
          addressesToQueue.push(trimmedInput);
          newResolvedAddresses.add(trimmedInput); // Assume address is valid until proven otherwise
        } else {
          nameLookups.push(trimmedInput);
        }
      }

      const fetchPromises: Promise<void>[] = [];

      // --- Phase 2: Queue Address Lookups via Batcher ---
      // This ensures that even if useNfdResolver is called with a list of addresses, 
      // they are pooled with any concurrent calls from useNfd.
      const addressResolutionPromises = addressesToQueue.map(address => queueNfdResolutionV2(address));
      
      fetchPromises.push((async () => {
          const results = await Promise.all(addressResolutionPromises);
          results.forEach(result => {
              if (result?.address) {
                  newResolvedAddresses.add(result.address);
              }
          });
      })());


      // --- Phase 3: Individual Name Lookups (cannot be batched by address) ---
      nameLookups.forEach(name => {
        fetchPromises.push((async () => {
          try {
            const apiUrl = `${NFD_API_URL}/nfd/${name}`; 
            console.log(`[useNfdResolver] Fetching name lookup for: ${name}`);
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
              console.warn(`[useNfdResolver] NFD name lookup failed for ${name}: HTTP status ${response.status}.`);
              nfdLookupCache.set(name, { name: null, avatar: null, address: null, timestamp: Date.now() });
              return;
            }
            const data = await response.json();
            
            if (data && data.owner) {
              const resolvedAddress = data.owner;
              const rawAvatarUrl = data.properties?.userDefined?.avatar || data.properties?.verified?.avatar;
              const avatarUrl = ipfsToGateway(rawAvatarUrl);
              
              let nfdName = data.name || null;
              if (nfdName && !nfdName.endsWith(".algo")) {
                nfdName = `${nfdName}.algo`;
              }

              newResolvedAddresses.add(resolvedAddress);
              const cachedResult = {
                name: nfdName,
                avatar: avatarUrl,
                address: resolvedAddress,
                timestamp: Date.now(),
              };
              nfdLookupCache.set(name, cachedResult);
              nfdLookupCache.set(resolvedAddress, cachedResult);
            } else {
                nfdLookupCache.set(name, { name: null, avatar: null, address: null, timestamp: Date.now() });
            }
          } catch (err) {
            console.error(`[useNfdResolver] Exception during NFD name fetch for ${name}:`, err);
            nfdLookupCache.set(name, { name: null, avatar: null, address: null, timestamp: Date.now() });
          }
        })());
      });

      await Promise.all(fetchPromises);
      
      // Re-aggregate all resolved addresses from cache (including those found in Phase 1)
      const finalResolvedAddresses = new Set<string>();
      inputs.forEach(input => {
          const entry = nfdLookupCache.get(input.trim());
          if (entry?.address) {
              finalResolvedAddresses.add(entry.address);
          } else if (input.trim().length === 58) {
              // If it was a direct address input, ensure it's included even if no NFD was found
              finalResolvedAddresses.add(input.trim());
          }
      });

      console.log("[useNfdResolver] Final resolved addresses after all promises:", Array.from(finalResolvedAddresses));
      setResolvedAddresses(finalResolvedAddresses);
      setLoading(false);
    };

    fetchResolutions();
  }, [inputs]);

  return { resolvedAddresses, loading };
}