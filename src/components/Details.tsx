"use client";

import { useWallet } from "@txnlab/use-wallet-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from '@/lib/utils'; // Import cn
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode

interface DetailsProps {
  isInsideCarousel?: boolean; // Add isInsideCarousel prop
}

export function Details({ isInsideCarousel = false }: DetailsProps) {
  const wallet = useWallet();
  const { isMobile } = useAppContextDisplayMode(); // Use useAppContextDisplayMode

  if (!wallet.activeAddress) {
    return null;
  }

  const displayableWalletState = {
    activeAddress: wallet.activeAddress,
    activeAccount: wallet.activeAccount,
    status: wallet.status,
    connected: wallet.connected,
    activeWallet: wallet.activeWallet ? {
      id: wallet.activeWallet.id,
      metadata: wallet.activeWallet.metadata,
      accounts: wallet.activeWallet.accounts,
      isConnected: wallet.activeWallet.isConnected,
    } : null,
  };

  return (
    <Card className="w-full max-w-md mt-8">
      <CardHeader>
        <CardTitle>Wallet Details</CardTitle>
        <CardDescription>
          Your connected wallet information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="text-left text-sm bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto">
          <code>
            {JSON.stringify(displayableWalletState, null, 2)}
          </code>
        </pre>
      </CardContent>
    </Card>
  );
}