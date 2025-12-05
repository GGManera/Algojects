"use client";

import { useEffect, useState, useCallback } from 'react';
import { nfdLookupCache, NFD_RESOLVER_CACHE_DURATION_MS, ipfsToGateway } from './useNfdResolver'; // Import shared cache, constant, and ipfsToGateway

interface NfdData {
  name: string | null;
  avatar: string | null;
  address: string | null;
  // NEW: Additional properties
  bio: string | null;
  twitter: string | null;
  discord: string | null;
  blueskydid: string | null;
}

// Map to hold pending addresses to be resolved in the next batch
const pendingAddressesToBatch = new Map<string, (result: NfdData | null) => void>();

// Map to hold promises for addresses currently being fetched in a batch
const activeBatchPromises = new Map<string, Promise<NfdData | null>>();

let debounceTimeout: NodeJS.Timeout | null = null;

const NFD_API_URL = "https://api.nf.domains";
const BATCH_DEBOUNCE_MS = 50; // Wait 50ms to collect addresses
const BATCH_SIZE = 20; // Max addresses per batch

/**
 * Executes the batch lookup using the NFD API.
 */
async function executeBatchLookup(addresses: string[]): Promise<Map<string, NfdData | null>> {
  const results = new Map<string, NfdData | null>();
  
  if (addresses.length === 0) return results;

  // Helper function to process raw NFD data
  const processNfdData = (data: any, address: string): NfdData => {
    // The NFD API returns an object where keys are addresses, or a single object if only one address was queried.
    const nfdData = data[address] || data;
    
    // Prioritize verified avatar if available, otherwise use userDefined
    const rawAvatarUrl = nfdData?.properties?.verified?.avatar || nfdData?.properties?.userDefined?.avatar;
    const avatarUrl = ipfsToGateway(rawAvatarUrl); // Use ipfsToGateway here

    let nfdName = nfdData?.name || null;
    if (nfdName && !nfdName.endsWith(".algo")) {
      nfdName = `${nfdName}.algo`;
    }
    
    // NEW: Extract additional properties, prioritizing verified
    const bio = nfdData?.properties?.userDefined?.bio || null;
    const twitter = nfdData?.properties?.verified?.twitter || nfdData?.properties?.userDefined?.twitter || null;
    const discord = nfdData?.properties?.verified?.discord || nfdData?.properties?.userDefined?.discord || null;
    const blueskydid = nfdData?.properties?.verified?.blueskydid || nfdData?.properties?.userDefined?.blueskydid || null;

    return {
      name: nfdName,
      avatar: avatarUrl,
      address: address,
      bio,
      twitter,
      discord,
      blueskydid,
    };
  };

  try {
    // CORRECTED: Construct the URL using multiple 'address=' parameters
    const addressParams = addresses.map(addr => `address=${addr}`).join('&');
    const apiUrl = `${NFD_API_URL}/nfd/lookup?${addressParams}&view=full`;
    console.log(`[NfdBatcher] Executing batch lookup for ${addresses.length} addresses.`);
    
    const response = await fetch(apiUrl);
    
    // Handle 404 explicitly as a valid return status for no matches
    if (response.status === 404) {
        console.log(`[NfdBatcher] Batch lookup returned 404 (No NFDs found for batch).`);
        addresses.forEach(address => results.set(address, { name: null, avatar: null, address: address, bio: null, twitter: null, discord: null, blueskydid: null }));
        return results;
    }

    if (!response.ok) {
      console.error(`[NfdBatcher] Batch lookup failed: HTTP status ${response.status}.`);
      throw new Error(`NFD batch lookup failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    for (const address of addresses) {
      const resolvedNfdObject = data[address];
      
      // Check if the address key exists in the response data
      if (resolvedNfdObject) {
        const result = processNfdData(data, address);
        results.set(address, result);
      } else {
        // If the address was in the request but not in the response, it means no NFD points to it.
        results.set(address, { name: null, avatar: null, address: address, bio: null, twitter: null, discord: null, blueskydid: null });
      }
    }
  } catch (err) {
    console.error(`[NfdBatcher] Exception during batch fetch:`, err);
    addresses.forEach(address => results.set(address, { name: null, avatar: null, address: address, bio: null, twitter: null, discord: null, blueskydid: null }));
  }
  
  return results;
}

// Map to store { resolve, reject } functions for promises created in queueNfdResolution
const promiseResolvers = new Map<string, { resolve: (result: NfdData | null) => void, reject: (error: Error) => void }>();

/**
 * The core function to queue an address for batch resolution (V2).
 * @param address The Algorand address to resolve.
 * @returns A promise that resolves with the NFD data.
 */
export function queueNfdResolutionV2(address: string): Promise<NfdData | null> {
  const trimmedAddress = address.trim();

  // 1. Check shared cache (already handled by useNfd, but good practice)
  const cachedNfdEntry = nfdLookupCache.get(trimmedAddress);
  const isFresh = cachedNfdEntry && (Date.now() - cachedNfdEntry.timestamp < NFD_RESOLVER_CACHE_DURATION_MS);
  if (isFresh) {
    // Ensure cached entry has all new fields
    const cachedData: NfdData = {
        name: cachedNfdEntry.name,
        avatar: cachedNfdEntry.avatar,
        address: cachedNfdEntry.address,
        bio: cachedNfdEntry.bio || null,
        twitter: cachedNfdEntry.twitter || null,
        discord: cachedNfdEntry.discord || null,
        blueskydid: cachedNfdEntry.blueskydid || null,
    };
    return Promise.resolve(cachedData);
  }

  // 2. Check if already in the queue or actively fetching
  if (promiseResolvers.has(trimmedAddress)) {
    return activeBatchPromises.get(trimmedAddress)!;
  }

  // 3. Create a new promise and store its resolver
  let resolveFn: (result: NfdData | null) => void;
  let rejectFn: (error: Error) => void;
  
  const promise = new Promise<NfdData | null>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  promiseResolvers.set(trimmedAddress, { resolve: resolveFn!, reject: rejectFn! });
  activeBatchPromises.set(trimmedAddress, promise); // Store the promise globally for deduplication

  // 4. Add to the batch queue (using the promiseResolvers map as the queue)
  
  // 5. Debounce the execution
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }

  debounceTimeout = setTimeout(processBatchV2, BATCH_DEBOUNCE_MS);

  return promise;
}

/**
 * Processes the collected batch of addresses (V2).
 */
async function processBatchV2() {
  if (promiseResolvers.size === 0) return;

  const addressesToFetch = Array.from(promiseResolvers.keys());
  
  // Split into chunks of BATCH_SIZE
  const chunks: string[][] = [];
  for (let i = 0; i < addressesToFetch.length; i += BATCH_SIZE) {
    chunks.push(addressesToFetch.slice(i, i + BATCH_SIZE));
  }

  const allResults = new Map<string, NfdData | null>();

  for (const chunk of chunks) {
    const chunkResults = await executeBatchLookup(chunk);
    chunkResults.forEach((result, address) => {
      allResults.set(address, result);
    });
  }

  // Resolve all pending promises and update cache
  addressesToFetch.forEach(address => {
    const result = allResults.get(address) || { name: null, avatar: null, address: address, bio: null, twitter: null, discord: null, blueskydid: null };
    const resolver = promiseResolvers.get(address);
    
    if (resolver) {
      // Update shared cache, ensuring all fields are present
      nfdLookupCache.set(address, { 
          ...result, 
          timestamp: Date.now(),
          bio: result.bio || null,
          twitter: result.twitter || null,
          discord: result.discord || null,
          blueskydid: result.blueskydid || null,
      });
      
      // Resolve the promise
      resolver.resolve(result);
      
      // Clean up
      promiseResolvers.delete(address);
      activeBatchPromises.delete(address);
    }
  });
}