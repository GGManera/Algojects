"use client";

import { useState, useEffect } from 'react';

// Cache simples na memória para armazenar dados de NFD e evitar chamadas repetidas
// Import the shared cache map from useNfdResolver
import { nfdLookupCache } from './useNfdResolver';

interface NfdData {
  name: string | null;
  avatar: string | null;
}

const NFD_API_URL = "https://api.nf.domains";
const NFD_CACHE_DURATION_MS = 15 * 1000; // 15 seconds for NFD cache

const ipfsToGateway = (url: string | undefined): string | null => {
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

// Helper function to process raw NFD data into NfdData structure
const processNfdData = (data: any, address: string): NfdData => {
    const nfdData = data[address] || data; // Handle both batched (keyed by address) and single lookups
    
    const rawAvatarUrl = nfdData?.properties?.userDefined?.avatar || nfdData?.properties?.verified?.avatar;
    const avatarUrl = ipfsToGateway(rawAvatarUrl);

    let nfdName = nfdData?.name || null;
    if (nfdName && !nfdName.endsWith(".algo")) {
      nfdName = `${nfdName}.algo`;
    }

    return {
      name: nfdName,
      avatar: avatarUrl,
    };
};


export function useNfd(address: string | undefined) {
  const [nfd, setNfd] = useState<NfdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any>(null);

  useEffect(() => {
    if (!address) {
      setNfd(null);
      setRawData(null);
      setLoading(false);
      return;
    }
    
    const trimmedAddress = address.trim();

    // Check shared cache first. If found and fresh, update state and return early.
    const cachedNfdEntry = nfdLookupCache.get(trimmedAddress);
    const isFresh = cachedNfdEntry && (Date.now() - cachedNfdEntry.timestamp < NFD_CACHE_DURATION_MS);

    if (isFresh) {
      setNfd(cachedNfdEntry);
      setRawData(cachedNfdEntry); // Use cached entry as raw data placeholder
      setLoading(false);
      console.log(`[useNfd] Shared Cache HIT (fresh) para o endereço: ${trimmedAddress}.`);
      return;
    }

    // If not in cache, or cache is stale, proceed to fetch
    setLoading(true);
    setNfd(null);
    setRawData(null);

    console.log(`[useNfd] Cache MISS ou STALE para o endereço: ${trimmedAddress}. Iniciando busca individual.`);

    const fetchNfd = async () => {
      try {
        const response = await fetch(`${NFD_API_URL}/nfd/lookup?address=${trimmedAddress}&view=full`);
        
        if (response.status === 404) {
          console.log(`[useNfd] NFD não encontrado (404) para o endereço: ${trimmedAddress}`);
          const data = { name: null, avatar: null, address: trimmedAddress, timestamp: Date.now() };
          nfdLookupCache.set(trimmedAddress, data);
          setNfd(data);
          setRawData({ error: "NFD not found (404)" });
          return;
        }

        if (!response.ok) {
          throw new Error(`A API respondeu com o status ${response.status}`);
        }

        const data = await response.json();
        setRawData(data);

        const result: NfdData = processNfdData(data, trimmedAddress);
        
        const cachedResult = { ...result, address: trimmedAddress, timestamp: Date.now() };
        console.log(`[useNfd] Dados NFD finais sendo definidos/armazenados em cache para ${trimmedAddress}:`, cachedResult);
        nfdLookupCache.set(trimmedAddress, cachedResult);
        setNfd(result);
      } catch (err) {
        console.error(`[useNfd] Falha ao buscar NFD para ${trimmedAddress}:`, err);
        const data = { name: null, avatar: null, address: trimmedAddress, timestamp: Date.now() };
        nfdLookupCache.set(trimmedAddress, data);
        setNfd(data);
        setRawData({ error: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        setLoading(false);
      }
    };

    fetchNfd();
  }, [address]);

  return { nfd, loading, rawData };
}