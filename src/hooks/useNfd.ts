"use client";

import { useState, useEffect } from 'react';

// Cache simples na memória para armazenar dados de NFD e evitar chamadas repetidas
// Modified to store timestamp
const nfdCache = new Map<string, (NfdData & { timestamp: number }) | null>();
const rawDataCache = new Map<string, any>(); // Cache for raw data

interface NfdData {
  name: string | null;
  avatar: string | null;
}

const NFD_CACHE_DURATION_MS = 15 * 1000; // 15 seconds for NFD cache

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

export function useNfd(address: string | undefined) {
  // Initialize state based on cache immediately for the first render
  const initialNfd = address && nfdCache.has(address) ? nfdCache.get(address)! : null;
  const initialRawData = address && rawDataCache.has(address) ? rawDataCache.get(address)! : null;
  // Loading should be true only if an address is provided AND it's NOT in cache
  const initialLoadingState = !!address && (!nfdCache.has(address) || !rawDataCache.has(address));

  const [nfd, setNfd] = useState<NfdData | null>(initialNfd);
  const [loading, setLoading] = useState(initialLoadingState);
  const [rawData, setRawData] = useState<any>(initialRawData);

  useEffect(() => {
    if (!address) {
      setNfd(null);
      setRawData(null);
      setLoading(false);
      return;
    }

    // Check cache first. If found and fresh, update state and return early.
    const cachedNfdEntry = nfdCache.get(address);
    const cachedRawEntry = rawDataCache.get(address);

    if (cachedNfdEntry && cachedRawEntry && (Date.now() - cachedNfdEntry.timestamp < NFD_CACHE_DURATION_MS)) {
      setNfd(cachedNfdEntry);
      setRawData(cachedRawEntry);
      setLoading(false); // Ensure loading is false
      console.log(`[useNfd] Cache HIT (fresh) para o endereço: ${address}.`);
      return; // Exit early, no fetch needed
    }

    // If not in cache, or cache is stale, then proceed to fetch
    setLoading(true); // Set loading to true before fetch
    setNfd(null); // Clear previous NFD data to show skeleton for new fetch
    setRawData(null); // Clear previous raw data

    console.log(`[useNfd] Cache MISS ou STALE para o endereço: ${address}. Iniciando busca.`);

    const fetchNfd = async () => {
      try {
        console.log(`[useNfd] Buscando NFD para o endereço: ${address}`);
        const response = await fetch(`https://api.nf.domains/nfd/lookup?address=${address}&view=full`);
        
        if (response.status === 404) {
          console.log(`[useNfd] NFD não encontrado (404) para o endereço: ${address}`);
          const data = { name: null, avatar: null, timestamp: Date.now() }; // Store error with timestamp
          nfdCache.set(address, data);
          setNfd(data);
          const errorData = { error: "NFD not found (404)" };
          setRawData(errorData);
          rawDataCache.set(address, errorData);
          return;
        }

        if (!response.ok) {
          throw new Error(`A API respondeu com o status ${response.status}`);
        }

        const data = await response.json();
        setRawData(data); // Define os dados brutos
        rawDataCache.set(address, data); // Armazena em cache os dados brutos
        console.log(`[useNfd] Dados brutos da API para ${address}:`, data);

        const nfdData = data[address]; // A API NFD retorna um objeto com chave pelo endereço
        
        // Verifica o avatar primeiro em 'userDefined', depois em 'verified'
        const rawAvatarUrl = nfdData?.properties?.userDefined?.avatar || nfdData?.properties?.verified?.avatar;
        console.log(`[useNfd] URL do avatar bruto para ${address}:`, rawAvatarUrl);
        const avatarUrl = ipfsToGateway(rawAvatarUrl);
        console.log(`[useNfd] URL do avatar processado para ${address}:`, avatarUrl);

        let nfdName = nfdData?.name || null;
        console.log(`[useNfd] Nome NFD da API (antes da verificação de sufixo): '${nfdName}'`);
        // Garante que o sufixo .algo esteja presente para nomes NFD se ainda não estiver lá
        if (nfdName && !nfdName.endsWith(".algo")) {
          nfdName = `${nfdName}.algo`;
          console.log(`[useNfd] Nome NFD após adicionar '.algo': '${nfdName}'`);
        } else if (nfdName) {
          console.log(`[useNfd] Nome NFD já possui '.algo': '${nfdName}'`);
        }

        const result: NfdData = {
          name: nfdName,
          avatar: avatarUrl,
        };
        
        const cachedResult = { ...result, timestamp: Date.now() }; // Add timestamp
        console.log(`[useNfd] Dados NFD finais sendo definidos/armazenados em cache para ${address}:`, cachedResult);
        nfdCache.set(address, cachedResult); // Store with timestamp
        setNfd(result);
      } catch (err) {
        console.error(`[useNfd] Falha ao buscar NFD para ${address}:`, err);
        const data = { name: null, avatar: null, timestamp: Date.now() }; // Store error with timestamp
        nfdCache.set(address, data);
        setNfd(data);
        const errorData = { error: err instanceof Error ? err.message : "Unknown error" };
        setRawData(errorData);
        rawDataCache.set(address, errorData);
      } finally {
        setLoading(false);
      }
    };

    fetchNfd();
  }, [address]); // Dependência do useEffect é o endereço

  return { nfd, loading, rawData };
}