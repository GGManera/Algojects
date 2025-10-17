"use client";

import { useState, useEffect, useMemo } from 'react';

// Cache for NFD/Address resolutions
const addressResolutionCache = new Map<string, { address: string | null; timestamp: number }>();
const ADDRESS_CACHE_DURATION_MS = 15 * 1000; // 15 seconds

/**
 * Resolves a single input (Algorand address or NFD name) to a canonical Algorand address.
 */
export function useNfdAddressResolver(input: string | undefined) {
  const trimmedInput = useMemo(() => input?.trim().toLowerCase(), [input]);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trimmedInput) {
      setResolvedAddress(null);
      setLoading(false);
      setError(null);
      return;
    }

    // 1. Check cache
    const cachedEntry = addressResolutionCache.get(trimmedInput);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < ADDRESS_CACHE_DURATION_MS)) {
      setResolvedAddress(cachedEntry.address);
      setLoading(false);
      setError(null);
      return;
    }

    // 2. Check if it's already a valid Algorand address (58 chars)
    if (trimmedInput.length === 58) {
      // Simple check for address validity (we assume it's valid if 58 chars, NFD API will confirm if it exists)
      setResolvedAddress(trimmedInput);
      setLoading(false);
      setError(null);
      addressResolutionCache.set(trimmedInput, { address: trimmedInput, timestamp: Date.now() });
      return;
    }

    // 3. Resolve NFD name
    setLoading(true);
    setError(null);
    setResolvedAddress(null);

    const fetchResolution = async () => {
      try {
        // Use the NFD lookup by name endpoint
        const response = await fetch(`https://api.nf.domains/nfd/${trimmedInput}`);
        
        if (response.status === 404) {
          throw new Error(`NFD '${trimmedInput}' not found.`);
        }

        if (!response.ok) {
          throw new Error(`NFD API lookup failed with status ${response.status}.`);
        }

        const data = await response.json();
        const address = data?.owner;

        if (address && address.length === 58) {
          setResolvedAddress(address);
          addressResolutionCache.set(trimmedInput, { address, timestamp: Date.now() });
        } else {
          throw new Error(`NFD '${trimmedInput}' found but has no associated owner address.`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown resolution error.";
        setError(errorMessage);
        setResolvedAddress(null);
        addressResolutionCache.set(trimmedInput, { address: null, timestamp: Date.now() });
      } finally {
        setLoading(false);
      }
    };

    fetchResolution();
  }, [trimmedInput]);

  return { resolvedAddress, loading, error };
}