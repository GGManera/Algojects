"use client";

import { useEffect, useState, useCallback } from 'react';
import { nfdLookupCache } from './useNfdResolver'; // Import shared cache

interface NfdData {
  name: string | null;
  avatar: string | null;
  address: string | null;
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
    const nfdData = data[address] || data;
    
    const rawAvatarUrl = nfdData?.properties?.verified?.avatar || nfdData?.properties?.userDefined?.avatar;
    const avatarUrl = nfdData?.properties?.userDefined?.avatar || nfdData?.properties?.verified?.avatar; // Simplified IPFS handling for now, relying on NFD API to return direct URLs if possible

    let nfdName = nfdData?.name || null;
    if (nfdName && !nfdName.endsWith(".algo")) {
      nfdName = `${nfdName}.algo`;
    }

    return {
      name: nfdName,
      avatar: avatarUrl,
      address: address,
    };
  };

  try {
    const batchString = addresses.join(',');
    const apiUrl = `${NFD_API_URL}/nfd/lookup?address=${batchString}&view=full`;
    console.log(`[NfdBatcher] Executing batch lookup for ${addresses.length} addresses.`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error(`[NfdBatcher] Batch lookup failed: HTTP status ${response.status}.`);
      throw new Error(`NFD batch lookup failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    for (const address of addresses) {
      const resolvedNfdObject = data[address];
      if (resolvedNfdObject && resolvedNfdObject.owner) {
        const result = processNfdData(data, address);
        results.set(address, result);
      } else {
        results.set(address, { name: null, avatar: null, address: address });
      }
    }
  } catch (err) {
    console.error(`[NfdBatcher] Exception during batch fetch:`, err);
    addresses.forEach(address => results.set(address, { name: null, avatar: null, address: address }));
  }
  
  return results;
}

/**
 * The core function to queue an address for batch resolution.
 * @param address The Algorand address to resolve.
 * @returns A promise that resolves with the NFD data.
 */
export function queueNfdResolution(address: string): Promise<NfdData | null> {
  const trimmedAddress = address.trim();

  // 1. Check if already being fetched in an active batch
  if (activeBatchPromises.has(trimmedAddress)) {
    return activeBatchPromises.get(trimmedAddress)!;
  }

  // 2. Check if already in the queue (shouldn't happen if called correctly, but safe)
  if (pendingAddressesToBatch.has(trimmedAddress)) {
    // Create a promise that resolves when the batch resolves
    const promise = new Promise<NfdData | null>((resolve) => {
        // Overwrite the existing resolver function to call both
        const existingResolver = pendingAddressesToBatch.get(trimmedAddress)!;
        pendingAddressesToBatch.set(trimmedAddress, (result) => {
            existingResolver(result);
            resolve(result);
        });
    });
    activeBatchPromises.set(trimmedAddress, promise); // Temporarily store in active promises
    return promise;
  }

  // 3. Create a new promise and add to the queue
  const promise = new Promise<NfdData | null>((resolve) => {
    pendingAddressesToBatch.set(trimmedAddress, resolve);
  });
  activeBatchPromises.set(trimmedAddress, promise); // Store the promise globally

  // 4. Debounce the execution
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }

  debounceTimeout = setTimeout(processBatch, BATCH_DEBOUNCE_MS);

  return promise;
}

/**
 * Processes the collected batch of addresses.
 */
async function processBatch() {
  if (pendingAddressesToBatch.size === 0) return;

  const addressesToFetch = Array.from(pendingAddressesToBatch.keys());
  pendingAddressesToBatch.clear(); // Clear the queue immediately

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
  allResults.forEach((result, address) => {
    const resolver = activeBatchPromises.get(address);
    if (resolver) {
      // Update shared cache
      if (result) {
        nfdLookupCache.set(address, { ...result, timestamp: Date.now() });
      } else {
        nfdLookupCache.set(address, { name: null, avatar: null, address: address, timestamp: Date.now() });
      }
      
      // Resolve the promise
      const promise = activeBatchPromises.get(address);
      if (promise) {
        // We need to resolve the promise that was stored in activeBatchPromises
        // Since we can't directly resolve a promise from outside its constructor, 
        // we rely on the resolver function stored in pendingAddressesToBatch.
        // Since we cleared pendingAddressesToBatch, we must rely on the promise itself.
        // The initial implementation of queueNfdResolution needs to expose the resolve function.
        // Let's simplify: we will only use activeBatchPromises to track status, and rely on the cache for results.
        // Since we can't easily modify the promise resolution, we'll just rely on the cache update and let the useEffect in useNfd handle the cache hit.
        // However, since we are removing the direct fetch from useNfd, we must resolve the promise.
        
        // Reverting to the original plan: queueNfdResolution must return a promise that resolves when the batch is done.
        // The promise is already stored in activeBatchPromises. We need to find the original resolver.
        
        // Let's adjust queueNfdResolution to store the resolver function directly in activeBatchPromises.
        // RETHINK: The current structure of activeBatchPromises storing the Promise object is correct.
        // The promise object itself needs to be resolved. We need to store the resolve function.
        
        // Let's modify queueNfdResolution to store { promise, resolve } in a new map.
        
        // --- RE-IMPLEMENTING PROMISE HANDLING ---
        const promiseContainer = promiseResolvers.get(address);
        if (promiseContainer) {
            promiseContainer.resolve(result);
            promiseResolvers.delete(address);
        }
      }
    }
    activeBatchPromises.delete(address); // Clear active status
  });
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
  const isFresh = cachedNfdEntry && (Date.now() - cachedNfdEntry.timestamp < NFD_CACHE_DURATION_MS);
  if (isFresh) {
    return Promise.resolve(cachedNfdEntry);
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
    const result = allResults.get(address) || { name: null, avatar: null, address: address };
    const resolver = promiseResolvers.get(address);
    
    if (resolver) {
      // Update shared cache
      nfdLookupCache.set(address, { ...result, timestamp: Date.now() });
      
      // Resolve the promise
      resolver.resolve(result);
      
      // Clean up
      promiseResolvers.delete(address);
      activeBatchPromises.delete(address);
    }
  });
}