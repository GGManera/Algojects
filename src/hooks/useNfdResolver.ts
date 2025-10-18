"use client";

import { useState, useEffect } from 'react';

interface NfdData {
  name: string | null;
  avatar: string | null;
  address: string | null;
}

// Modified to store timestamp
const nfdLookupCache = new Map<string, (NfdData & { timestamp: number }) | null>();

const NFD_RESOLVER_CACHE_DURATION_MS = 15 * 1000; // 15 seconds for NFD resolver cache
const NFD_API_URL = "https://api.nf.domains";
const BATCH_SIZE = 20; // Max addresses per batch

const ipfsToGateway = (url: string | undefined): string | null => {
  if (!url) return null;

  // If it's already a direct HTTP/HTTPS URL, use it as is.
  // This includes imageproxy.nf.domains and other direct image links,
  // as well as NFD's own IPFS gateways like ipfsfgw.nf.domains.
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
      const addressesToBatch = new Set<string>();
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
          addressesToBatch.add(trimmedInput);
          newResolvedAddresses.add(trimmedInput); // Assume address is valid until proven otherwise
        } else {
          nameLookups.push(trimmedInput);
        }
      }

      const fetchPromises: Promise<void>[] = [];

      // --- Phase 2: Batch Address Lookups ---
      const addressArray = Array.from(addressesToBatch);
      for (let i = 0; i < addressArray.length; i += BATCH_SIZE) {
        const batch = addressArray.slice(i, i + BATCH_SIZE);
        const batchString = batch.join(',');
        
        fetchPromises.push((async () => {
          try {
            const apiUrl = `${NFD_API_URL}/nfd/lookup?address=${batchString}&view=full`;
            console.log(`[useNfdResolver] Fetching address batch (${batch.length}): ${apiUrl}`);
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
              console.warn(`[useNfdResolver] NFD batch lookup failed: HTTP status ${response.status}.`);
              return;
            }
            const data = await response.json();
            
            // Process batched results (data is an object keyed by address)
            for (const address of batch) {
              const resolvedNfdObject = data[address];
              
              if (resolvedNfdObject && resolvedNfdObject.owner) {
                const rawAvatarUrl = resolvedNfdObject.properties?.verified?.avatar;
                const avatarUrl = ipfsToGateway(rawAvatarUrl);
                
                nfdLookupCache.set(address, {
                  name: resolvedNfdObject.name || null,
                  avatar: avatarUrl,
                  address: resolvedNfdObject.owner,
                  timestamp: Date.now(),
                });
              } else {
                // Cache the address even if no NFD is found for it
                nfdLookupCache.set(address, { name: null, avatar: null, address: address, timestamp: Date.now() });
              }
            }
          } catch (err) {
            console.error(`[useNfdResolver] Exception during NFD batch fetch:`, err);
            // On error, mark all addresses in the batch as failed/stale in cache
            batch.forEach(address => {
                nfdLookupCache.set(address, { name: null, avatar: null, address: address, timestamp: Date.now() });
            });
          }
        })());
      }

      // --- Phase 3: Individual Name Lookups ---
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
              const rawAvatarUrl = data.properties?.verified?.avatar;
              const avatarUrl = ipfsToGateway(rawAvatarUrl);
              
              newResolvedAddresses.add(resolvedAddress);
              nfdLookupCache.set(name, {
                name: data.name || null,
                avatar: avatarUrl,
                address: resolvedAddress,
                timestamp: Date.now(),
              });
              // Also cache by resolved address for consistency
              nfdLookupCache.set(resolvedAddress, {
                name: data.name || null,
                avatar: avatarUrl,
                address: resolvedAddress,
                timestamp: Date.now(),
              });
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