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
import { AlertTriangle, Wallet } from "lucide-react";
import { cn } from '@/lib/utils'; // Import cn
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode

interface OwnedAssetsProps {
  isInsideCarousel?: boolean; // Add isInsideCarousel prop
}

export function OwnedAssets({ isInsideCarousel = false }: OwnedAssetsProps) {
  const { activeAddress } = useWallet();
  const { heroAssetHoldings, heroAssets, loading, error } = useAccountData(activeAddress);
  const { isMobile } = useAppContextDisplayMode(); // Use useAppContextDisplayMode

  const ownedAssetsWithDetails = useMemo(() => {
    if (!heroAssetHoldings.length || !heroAssets.length) return [];

    const heroAssetsMap = new Map(heroAssets.map(asset => [asset.index, asset]));

    return heroAssetHoldings
      .filter(holding => holding.amount > 0)
      .map(owned => {
        const details = heroAssetsMap.get(owned['asset-id']);
        return {
          ...owned,
          details: details?.params,
        };
      }).filter(item => item.details);
  }, [heroAssetHoldings, heroAssets]);

  if (!activeAddress) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Owned Assets
        </CardTitle>
        <CardDescription>
          HERO assets you own in your wallet.
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
        {!loading && !error && ownedAssetsWithDetails.length > 0 && (
          <ul className="space-y-2 text-sm">
            {ownedAssetsWithDetails.map((asset) => (
              <li key={asset['asset-id']} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                <div>
                  <strong>{asset.details?.name || `Asset ${asset['asset-id']}`}</strong>
                  <span className="block text-xs text-muted-foreground">ID: {asset['asset-id']}</span>
                </div>
                <div className="text-right">
                    <p className="font-bold text-primary">
                        {asset.amount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Owned
                    </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && ownedAssetsWithDetails.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            No 'HERO' assets found in your wallet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}