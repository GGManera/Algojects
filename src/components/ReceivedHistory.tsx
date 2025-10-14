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
import { AlertTriangle, History } from "lucide-react";
import { cn } from '@/lib/utils'; // Import cn
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode

const CREATOR_ADDRESS = "PTPAK7NH3KA3D23WBR5GWVS57SO3FCJFBGK2IPDQQFFEXDHO4ENVH65PPM";

interface ReceivedHistoryProps {
  isInsideCarousel?: boolean; // Add isInsideCarousel prop
}

export function ReceivedHistory({ isInsideCarousel = false }: ReceivedHistoryProps) {
  const { activeAddress } = useWallet();
  const { heroAssets, heroAssetHoldings, transactions, loading, error } = useAccountData(activeAddress);
  const { isMobile } = useAppContextDisplayMode(); // Use useAppContextDisplayMode

  const receivedTransactions = useMemo(() => {
    if (!heroAssets.length || !transactions.length) return [];
    
    const heroAssetIds = new Set<number>(heroAssets.map(asset => asset.index));
    
    const ownedAssetIds = new Set<number>(
      heroAssetHoldings
        .filter(holding => holding.amount > 0)
        .map(holding => holding['asset-id'])
    );

    return transactions.filter(tx => {
      if (tx.sender !== CREATOR_ADDRESS || tx['tx-type'] !== 'axfer' || !tx['asset-transfer-transaction']) {
        return false;
      }
      
      const assetId = tx['asset-transfer-transaction']['asset-id'];

      return heroAssetIds.has(assetId) && !ownedAssetIds.has(assetId);
    });
  }, [heroAssets, transactions, heroAssetHoldings]);

  if (!activeAddress) {
    return null;
  }

  return (
    <Card className="w-full max-w-md mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Received History
        </CardTitle>
        <CardDescription>
          History of 'HERO' assets received that you no longer own.
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
        {!loading && !error && receivedTransactions.length > 0 && (
          <ul className="space-y-2 text-sm">
            {receivedTransactions.map((tx) => (
              <li key={tx.id} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                <div>
                  <p className="font-mono text-xs truncate w-40" title={tx.id}>
                    ID: {tx.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx['round-time'] * 1000).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  {tx['asset-transfer-transaction'] && (
                    <>
                      <p className="font-bold text-green-400">
                        + {tx['asset-transfer-transaction'].amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Asset ID: {tx['asset-transfer-transaction']['asset-id']}
                      </p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && receivedTransactions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            No reward history to show.
          </p>
        )}
      </CardContent>
    </Card>
  );
}