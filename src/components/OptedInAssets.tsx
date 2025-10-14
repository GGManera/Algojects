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
import { AlertTriangle, CheckCircle } from "lucide-react";

const CREATOR_ADDRESS = "PTPAK7NH3KA3D23WBR5GWVS57SO3FCJFBGK2IPDQQFFEXDHO4ENVH65PPM";

export function OptedInAssets() {
  const { activeAddress } = useWallet();
  const { heroAssets, heroAssetHoldings, transactions, loading, error } = useAccountData(activeAddress);

  const receivedAssetIds = useMemo(() => {
    if (!heroAssets.length || !transactions.length) return new Set<number>();
    
    const heroAssetIds = new Set<number>(heroAssets.map(asset => asset.index));
    const receivedIds = new Set<number>();

    transactions.forEach(tx => {
      if (tx.sender === CREATOR_ADDRESS && tx['tx-type'] === 'axfer' && tx['asset-transfer-transaction']) {
        const assetId = tx['asset-transfer-transaction']['asset-id'];
        if (heroAssetIds.has(assetId)) {
          receivedIds.add(assetId);
        }
      }
    });
    return receivedIds;
  }, [heroAssets, transactions]);

  const optedInAssets = useMemo(() => {
    if (!heroAssetHoldings.length || !heroAssets.length) return [];

    const heroAssetsMap = new Map(heroAssets.map(asset => [asset.index, asset.params]));

    return heroAssetHoldings
      .filter(holding => holding.amount === 0) // Rule 1: Must have zero balance
      .filter(holding => !receivedAssetIds.has(holding['asset-id'])) // Rule 2: Must not have been received
      .map(holding => {
        const params = heroAssetsMap.get(holding['asset-id']);
        return params ? { index: holding['asset-id'], params } : null;
      })
      .filter((asset): asset is { index: number; params: any } => asset !== null);
  }, [heroAssets, heroAssetHoldings, receivedAssetIds]);

  if (!activeAddress) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Opted-In Assets
        </CardTitle>
        <CardDescription>
          HERO assets you have Opt-In to but do not yet own.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
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
        {!loading && !error && optedInAssets.length > 0 && (
          <ul className="space-y-2 text-sm">
            {optedInAssets.map((asset) => (
              <li key={asset.index} className="flex items-center p-2 rounded-md bg-muted/50">
                <div>
                  <strong>{asset.params.name}</strong>
                  <span className="block text-xs text-muted-foreground">ID: {asset.index}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && optedInAssets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            No 'HERO' assets with Opt-In (and zero balance) found.
          </p>
        )}
      </CardContent>
    </Card>
  );
}