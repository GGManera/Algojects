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
      const promises: Promise<void>[] = [];

      for (const input of inputs) {
        const trimmedInput = input.trim();
        if (!trimmedInput) continue;

        let apiUrl: string | null = null;
        let queryParamType: 'name' | 'address';

        // Check cache first
        const cachedEntry = nfdLookupCache.get(trimmedInput);
        if (cachedEntry && (Date.now() - cachedEntry.timestamp < NFD_RESOLVER_CACHE_DURATION_MS)) {
          if (cachedEntry?.address) {
            console.log(`[useNfdResolver] Input '${trimmedInput}' found in cache (fresh), resolved to: ${cachedEntry.address}. Adding to resolved.`);
            newResolvedAddresses.add(cachedEntry.address);
            continue; // Only continue if a valid address was found in cache
          } else {
            console.log(`[useNfdResolver] Input '${trimmedInput}' found in cache (fresh), but no resolved address. Skipping fetch.`);
            continue; // If cached but no address, don't re-fetch immediately
          }
        } else if (cachedEntry) {
            console.log(`[useNfdResolver] Input '${trimmedInput}' found in cache, but STALE. Re-fetching.`);
            // Do not continue, proceed to fetch
        }

        // More robust check for Algorand address: 58 characters long
        if (trimmedInput.length === 58) {
          queryParamType = 'address';
          apiUrl = `https://api.nf.domains/nfd/lookup?address=${trimmedInput}&view=full`;
          newResolvedAddresses.add(trimmedInput); // Add direct address to resolved set
          console.log(`[useNfdResolver] Input '${trimmedInput}' identified as direct Algorand address. Added to resolved set.`);
        } else {
          queryParamType = 'name';
          // Usar o endpoint direto para lookup de NFD por nome
          apiUrl = `https://api.nf.domains/nfd/${trimmedInput}`; 
        }

        promises.push((async () => {
          if (!apiUrl) return;

          try {
            console.log(`[useNfdResolver] Attempting to fetch NFD for '${trimmedInput}' using ${queryParamType} parameter...`);
            const response = await fetch(apiUrl);
            
            console.log(`[useNfdResolver] NFD API response for '${trimmedInput}': status=${response.status}, ok=${response.ok}`);

            if (!response.ok) {
              console.warn(`[useNfdResolver] NFD lookup failed for ${trimmedInput}: HTTP status ${response.status}.`);
              const errorText = await response.text();
              console.warn(`[useNfdResolver] NFD lookup error details for '${trimmedInput}': ${errorText}`);
              nfdLookupCache.set(trimmedInput, { name: null, avatar: null, address: null, timestamp: Date.now() }); // Cache error state
              return;
            }
            const data = await response.json();
            console.log(`[useNfdResolver] Raw NFD data for '${trimmedInput}':`, data);

            let resolvedNfdObject: any = null;
            if (queryParamType === 'address') {
                // When querying by address, the API returns an object keyed by the address
                resolvedNfdObject = data[trimmedInput];
            } else if (queryParamType === 'name') {
                // When querying by name using /nfd/{name}, the API returns the NFD object directly
                resolvedNfdObject = data;
            }
            console.log(`[useNfdResolver] Resolved NFD object for '${trimmedInput}':`, resolvedNfdObject); // Novo log

            if (resolvedNfdObject && resolvedNfdObject.owner) {
              const resolvedAddress = resolvedNfdObject.owner;
              console.log(`[useNfdResolver] NFD '${trimmedInput}' resolved to address: ${resolvedAddress}. Adding to resolved.`);
              newResolvedAddresses.add(resolvedAddress);
              nfdLookupCache.set(trimmedInput, {
                name: resolvedNfdObject.name || null,
                avatar: ipfsToGateway(resolvedNfdObject.properties?.verified?.avatar),
                address: resolvedAddress,
                timestamp: Date.now(), // Add timestamp
              });
            } else if (queryParamType === 'address') {
                console.log(`[useNfdResolver] Address '${trimmedInput}' has no associated NFD data.`);
                nfdLookupCache.set(trimmedInput, { name: null, avatar: null, address: trimmedInput, timestamp: Date.now() }); // Cache even if no NFD found
            } else {
                console.warn(`[useNfdResolver] NFD '${trimmedInput}' found, but no 'owner' address in data. nfdData:`, resolvedNfdObject);
                nfdLookupCache.set(trimmedInput, { name: null, avatar: null, address: null, timestamp: Date.now() }); // Cache even if no owner
            }
          } catch (err) {
            console.error(`[useNfdResolver] Exception during NFD fetch for ${trimmedInput}:`, err);
            nfdLookupCache.set(trimmedInput, { name: null, avatar: null, address: null, timestamp: Date.now() }); // Cache error state
          }
        })());
      }

      await Promise.all(promises);
      console.log("[useNfdResolver] Final resolved addresses after all promises:", Array.from(newResolvedAddresses));
      setResolvedAddresses(newResolvedAddresses);
      setLoading(false);
    };

    fetchResolutions();
  }, [inputs]);

  return { resolvedAddresses, loading };
}