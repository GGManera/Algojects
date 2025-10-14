"use client";

import { useMemo } from "react";
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
import { AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from '@/lib/utils'; // Import cn
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode

const CREATOR_ADDRESS = "PTPAK7NH3KA3D23WBR5GWVS57SO3FCJFBGK2IPDQQFFEXDHO4ENVH65PPM";

interface MissingAssetsProps {
  isInsideCarousel?: boolean; // Add isInsideCarousel prop
}

export function MissingAssets({ isInsideCarousel = false }: MissingAssetsProps) {
  const { activeAddress } = useWallet();
  const { heroAssets, heroAssetHoldings, transactions, loading, error } = useAccountData(activeAddress);
  const { isMobile } = useAppContextDisplayMode(); // Use useAppContextDisplayMode

  const missingAssets = useMemo(() => {
    if (loading || !heroAssets.length) return [];

    const optedInAssetIds = new Set<number>(heroAssetHoldings.map(h => h['asset-id']));

    const receivedAssetIds = new Set<number>();
    const heroAssetIdsSet = new Set<number>(heroAssets.map(asset => asset.index));
    transactions.forEach(tx => {
      if (tx.sender === CREATOR_ADDRESS && tx['tx-type'] === 'axfer' && tx['asset-transfer-transaction']) {
        const assetId = tx['asset-transfer-transaction']['asset-id'];
        if (heroAssetIdsSet.has(assetId)) {
          receivedAssetIds.add(assetId);
        }
      }
    });

    const interactedAssetIds = new Set([...optedInAssetIds, ...receivedAssetIds]);

    return heroAssets.filter(asset => !interactedAssetIds.has(asset.index));

  }, [heroAssets, heroAssetHoldings, transactions, loading]);

  if (!activeAddress) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Missing Assets
        </CardTitle>
        <CardDescription>
          HERO assets you have not yet Opt-In to.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!loading && !error && missingAssets.length > 0 && (
          <ul className="space-y-2 text-sm">
            {missingAssets.map((asset) => (
              <li key={asset.index} className="flex items-center p-2 rounded-md bg-muted/50">
                <div>
                  <strong>{asset.params.name}</strong>
                  <span className="block text-xs text-muted-foreground">ID: {asset.index}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && missingAssets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            You have interacted with all 'HERO' assets!
          </p>
        )}
      </CardContent>
    </Card>
  );
}