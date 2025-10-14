"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useAccountData } from "@/hooks/useAccountData";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, List, CheckCircle, HelpCircle, XCircle, Wallet, History, LayoutGrid } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import algosdk from "algosdk";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode

const CREATOR_ADDRESS = "PTPAK7NH3KA3D23WBR5GWVS57SO3FCJFBGK2IPDQQFFEXDHO4ENVH65PPM";
const BATCH_SIZE = 16;

interface Asset {
  index: number;
  params: {
    name: string;
    "unit-name": string;
    total: number;
    creator: string;
    url: string;
  };
  imageUrl?: string;
  tier?: number;
}

interface ApiResponse {
  assets: Asset[];
}

interface GroupedAssetsByYear {
  [year: string]: {
    [monthEdition: string]: Asset[];
  };
}

const ipfsToGateway = (ipfsUrl: string) => {
  if (!ipfsUrl || !ipfsUrl.startsWith("ipfs://")) return null;
  return ipfsUrl.replace("ipfs://", "https://ipfs-pera.algonode.dev/ipfs/");
};

const parseMonthYear = (editionString: string): Date => {
  const [monthName, yearString] = editionString.split(' - ');
  const year = parseInt(yearString, 10);
  const monthIndex = new Date(Date.parse(`${monthName} 1, ${year}`)).getMonth();
  return new Date(year, monthIndex);
};

interface CreatedAssetsListProps {
  isInsideCarousel?: boolean; // Add isInsideCarousel prop
}

export function CreatedAssetsList({ isInsideCarousel = false }: CreatedAssetsListProps) {
  const [assetsWithMetadata, setAssetsWithMetadata] = useState<Asset[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const { isMobile } = useAppContextDisplayMode(); // Use useAppContextDisplayMode

  const { activeAddress, transactionSigner, algodClient } = useWallet();
  const { heroAssets, heroAssetHoldings, transactions, loading: accountDataLoading, error: accountDataError, refetch: refetchAccountData } = useAccountData(activeAddress);

  useEffect(() => {
    const fetchMetadata = async () => {
      if (!heroAssets.length) {
        setAssetsWithMetadata([]);
        setMetadataLoading(false);
        return;
      }

      setMetadataLoading(true);
      setMetadataError(null);
      try {
        const assetsWithDetails = await Promise.all(
          heroAssets.map(async (asset) => {
            try {
              const metadataUrl = ipfsToGateway(asset.params.url);
              if (!metadataUrl) return asset;
              const metaResponse = await fetch(metadataUrl);
              if (!metaResponse.ok) return asset;
              const metadata = await metaResponse.json();
              const imageUrl = ipfsToGateway(metadata.image);

              let tierValue = metadata.properties?.traits?.Tier;
              if (typeof tierValue === 'string') {
                const match = tierValue.match(/\d+/);
                tierValue = match ? parseInt(match[0], 10) : 0;
              } else if (typeof tierValue !== 'number') {
                tierValue = 0;
              }

              return { ...asset, imageUrl: imageUrl || undefined, tier: tierValue };
            } catch (e) {
              console.error(`Failed to fetch metadata for asset ${asset.index}:`, e);
              return asset;
            }
          })
        );
        setAssetsWithMetadata(assetsWithDetails);
      } catch (err) {
        setMetadataError(err instanceof Error ? err.message : "An unknown error occurred fetching metadata.");
      } finally {
        setMetadataLoading(false);
      }
    };
    fetchMetadata();
  }, [heroAssets]);

  const { ownedAssetIds, receivedAssetIds, optedInAssetIds, missingAssetsList } = useMemo(() => {
    if (!activeAddress || accountDataLoading || !assetsWithMetadata.length) {
      return {
        ownedAssetIds: new Set<number>(),
        receivedAssetIds: new Set<number>(),
        optedInAssetIds: new Set<number>(),
        missingAssetsList: [],
      };
    }

    const receivedIds = new Set<number>();
    const heroAssetIdsSet = new Set<number>(assetsWithMetadata.map(asset => asset.index));
    transactions.forEach(tx => {
      if (tx.sender === CREATOR_ADDRESS && tx['tx-type'] === 'axfer' && tx['asset-transfer-transaction']) {
        const assetId = tx['asset-transfer-transaction']['asset-id'];
        if (heroAssetIdsSet.has(assetId)) receivedIds.add(assetId);
      }
    });

    const ownedIds = new Set<number>();
    const optedInIds = new Set<number>();
    heroAssetHoldings.forEach(holding => {
      if (holding.amount > 0) {
        ownedIds.add(holding['asset-id']);
      } else if (!receivedIds.has(holding['asset-id'])) {
        optedInIds.add(holding['asset-id']);
      }
    });

    const interactedAssetIds = new Set([...optedInIds, ...receivedIds, ...ownedIds]);
    const currentMissingAssets = assetsWithMetadata.filter(asset => !interactedAssetIds.has(asset.index));

    return {
      ownedAssetIds: ownedIds,
      receivedAssetIds: receivedIds,
      optedInAssetIds: optedInIds,
      missingAssetsList: currentMissingAssets,
    };
  }, [activeAddress, accountDataLoading, heroAssetHoldings, transactions, assetsWithMetadata]);

  const counts = useMemo(() => {
    const totalCount = assetsWithMetadata.length;

    if (!activeAddress || totalCount === 0) {
      return { total: totalCount, owned: 0, receivedHistory: 0, optedIn: 0, missing: totalCount };
    }

    const receivedHistoryIds = new Set([...receivedAssetIds].filter(id => !ownedAssetIds.has(id)));

    const ownedCount = ownedAssetIds.size;
    const receivedHistoryCount = receivedHistoryIds.size;
    const optedInCount = optedInAssetIds.size;
    const missingCount = missingAssetsList.length;

    return {
      total: totalCount,
      owned: ownedCount,
      receivedHistory: receivedHistoryCount,
      optedIn: optedInCount,
      missing: missingCount,
    };
  }, [assetsWithMetadata, activeAddress, ownedAssetIds, receivedAssetIds, optedInAssetIds, missingAssetsList]);

  const filteredAssets = useMemo(() => {
    if (!activeAddress || filterCategory === 'all') {
      return assetsWithMetadata;
    }

    switch (filterCategory) {
      case 'owned':
        return assetsWithMetadata.filter(asset => ownedAssetIds.has(asset.index));
      case 'received':
        const receivedHistoryIds = new Set([...receivedAssetIds].filter(id => !ownedAssetIds.has(id)));
        return assetsWithMetadata.filter(asset => receivedHistoryIds.has(asset.index));
      case 'optedIn':
        return assetsWithMetadata.filter(asset => optedInAssetIds.has(asset.index));
      case 'missing':
        return assetsWithMetadata.filter(asset => missingAssetsList.some(m => m.index === asset.index));
      default:
        return assetsWithMetadata;
    }
  }, [assetsWithMetadata, filterCategory, activeAddress, ownedAssetIds, receivedAssetIds, optedInAssetIds, missingAssetsList]);

  const groupedAssetsByYear = useMemo(() => {
    if (filteredAssets.length === 0) return {};
    const grouped = filteredAssets.reduce((acc: GroupedAssetsByYear, asset) => {
      const nameParts = asset.params.name.split(" - ");
      let year: string;
      let monthEdition: string;

      if (nameParts.length >= 3) {
        year = nameParts[2].trim();
        monthEdition = nameParts[1].trim();
      } else {
        year = "Uncategorized";
        monthEdition = "Uncategorized";
      }

      if (!acc[year]) acc[year] = {};
      if (!acc[year][monthEdition]) acc[year][monthEdition] = [];
      acc[year][monthEdition].push(asset);
      return acc;
    }, {});

    for (const year in grouped) {
      for (const monthEdition in grouped[year]) {
        grouped[year][monthEdition].sort((a, b) => (b.tier || 0) - (a.tier || 0));
      }
    }

    return grouped;
  }, [filteredAssets]);

  const years = useMemo(() => Object.keys(groupedAssetsByYear).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return parseInt(a, 10) - parseInt(b, 10);
  }), [groupedAssetsByYear]);

  const isLoading = accountDataLoading || metadataLoading;
  const displayError = accountDataError || metadataError;

  const renderStatusIcon = (asset: Asset) => {
    if (!activeAddress || isLoading) return null;

    const isOwned = ownedAssetIds.has(asset.index);
    const isReceived = receivedAssetIds.has(asset.index);
    const isOptedIn = optedInAssetIds.has(asset.index);

    if (isOwned) return null;
    if (isReceived) {
      return (
        <Tooltip>
          <TooltipTrigger className="absolute top-1 right-1 z-10 scale-110"><CheckCircle className="h-5 w-5 text-green-400 bg-card rounded-full p-0.5" /></TooltipTrigger>
          <TooltipContent>Received</TooltipContent>
        </Tooltip>
      );
    }
    if (isOptedIn) {
      return (
        <Tooltip>
          <TooltipTrigger className="absolute top-1 right-1 z-10 scale-110"><HelpCircle className="h-5 w-5 text-yellow-400 bg-card rounded-full p-0.5" /></TooltipTrigger>
          <TooltipContent>Opted-In</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger className="absolute top-1 right-1 z-10 scale-110"><XCircle className="h-5 w-5 text-red-400 bg-card rounded-full p-0.5" /></TooltipTrigger>
        <TooltipContent>Missing</TooltipContent>
      </Tooltip>
    );
  };

  const handleOptInMissingAssets = async () => {
    if (!activeAddress || !transactionSigner || !algodClient) {
      showError("Please connect your wallet first.");
      return;
    }

    if (missingAssetsList.length === 0) {
      showError("No missing assets to opt-in to.");
      return;
    }

    const totalMissing = missingAssetsList.length;
    const numBatches = Math.ceil(totalMissing / BATCH_SIZE);

    let overallToastId: string | undefined;

    try {
      overallToastId = showLoading(`Preparing ${totalMissing} opt-in transactions in ${numBatches} batch(es)...`);

      const suggestedParams = await algodClient.getTransactionParams().do();

      for (let i = 0; i < numBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, totalMissing);
        const currentBatch = missingAssetsList.slice(start, end);

        if (currentBatch.length === 0) continue;

        const batchToastId = showLoading(`Processing batch ${i + 1} of ${numBatches} (${currentBatch.length} assets)... Please check your wallet.`);

        const atc = new algosdk.AtomicTransactionComposer();

        for (const asset of currentBatch) {
          const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender: activeAddress,
            receiver: activeAddress,
            amount: 0,
            assetIndex: asset.index,
            suggestedParams,
          });
          atc.addTransaction({ txn: optInTxn, signer: transactionSigner });
        }

        try {
          await atc.execute(algodClient, 4);
          dismissToast(batchToastId);
          showSuccess(`Batch ${i + 1} successful! Opted-in to ${currentBatch.length} assets.`);
        } catch (batchError) {
          dismissToast(batchToastId);
          console.error(`Error in batch ${i + 1}:`, batchError);
          showError(`Failed to opt-in for batch ${i + 1}. Some assets might not be opted-in.`);
        }
      }

      dismissToast(overallToastId);
      showSuccess(`Opt-in process completed for all ${totalMissing} assets across ${numBatches} batch(es)!`);
      await refetchAccountData();
    } catch (error) {
      if (overallToastId) dismissToast(overallToastId);
      console.error(error);
      showError(error instanceof Error ? error.message : "An unknown error occurred during the opt-in process.");
    }
  };

  const isLoading = accountDataLoading || metadataLoading;
  const displayError = accountDataError || metadataError;

  const renderMiniCard = (category: string, icon: React.ReactNode, label: string, count: number, textColorClass: string, isAllCard: boolean = false) => (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-2 rounded-md cursor-pointer transition-colors",
        "hover:bg-muted/70",
        !isAllCard && filterCategory === category ? "bg-primary/20 border border-primary" : "bg-muted/50"
      )}
      onClick={() => setFilterCategory(category)}
    >
      <span className={cn("text-lg font-bold font-numeric", textColorClass)}>{count}</span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon} {label}
      </span>
    </div>
  );

  return (
    <Card className="w-full max-w-md mt-8">
      <CardHeader>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-24 w-full" />}
        {displayError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{displayError}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !displayError && (
          <>
            {activeAddress && (
              <>
                <div className="mb-3">
                  {renderMiniCard('all', <LayoutGrid className="h-3 w-3" />, 'All', counts.total, 'gradient-text', true)}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {renderMiniCard('owned', <Wallet className="h-3 w-3" />, 'Owned', counts.owned, 'text-hodl-purple')}
                  {renderMiniCard('received', <History className="h-3 w-3" />, 'Received', counts.receivedHistory, 'text-green-400')}
                  {renderMiniCard('optedIn', <CheckCircle className="h-3 w-3" />, 'Opted-In', counts.optedIn, 'text-yellow-400')}
                  {renderMiniCard('missing', <XCircle className="h-3 w-3" />, 'Missing', counts.missing, 'text-red-400')}
                </div>
              </>
            )}
            {activeAddress && counts.missing > 0 && (
              <Button
                onClick={handleOptInMissingAssets}
                disabled={isLoading}
                className="w-full mt-4"
              >
                Opt-in to All Missing Assets (<span className="font-numeric">{counts.missing}</span>)
              </Button>
            )}
            <div className="space-y-4 mt-4">
              {years.length > 0 ? (
                years.map((year) => {
                  const monthEditions = Object.keys(groupedAssetsByYear[year]).sort((a, b) => {
                    const dateA = parseMonthYear(`${a} - ${year}`);
                    const dateB = parseMonthYear(`${b} - ${year}`);
                    return dateA.getTime() - dateB.getTime();
                  });

                  return (
                    <React.Fragment key={year}>
                      <h2 className="text-center text-2xl font-heading gradient-text mb-2 mt-6">{year}</h2>
                      <Card className="w-full bg-card">
                        <CardContent className="pt-4">
                          <div className="space-y-4">
                            {monthEditions.map((monthEdition, index) => (
                              <div key={monthEdition}>
                                <h5 className="text-md font-semibold mb-2 text-center gradient-text">{monthEdition}</h5>
                                <div className="flex flex-row overflow-x-auto gap-2 pb-2 scrollbar-thin justify-center">
                                  {groupedAssetsByYear[year][monthEdition].map((asset) => (
                                    <div key={asset.index} className="flex-shrink-0 relative">
                                      {renderStatusIcon(asset)}
                                      {asset.imageUrl ? (
                                        <img
                                          src={asset.imageUrl}
                                          alt={asset.params.name}
                                          className={`w-20 h-20 rounded-md object-cover transition-all ${activeAddress && !ownedAssetIds.has(asset.index) ? 'filter grayscale' : ''}`}
                                        />
                                      ) : (
                                        <Skeleton className="h-20 w-20 rounded-md" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {index < monthEditions.length - 1 && (
                                  <div className="border-b border-border pb-1 mt-2"></div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </React.Fragment>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  No assets found for the selected category.
                </p>
              )}
            </div>
          </>
        )}
        {!isLoading && !displayError && years.length === 0 && <p className="text-sm text-muted-foreground">No "HERO" assets found.</p>}
      </CardContent>
    </Card>
  );
}