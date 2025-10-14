"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Gem } from "lucide-react";
import { UserProjectTokenHolding } from '@/hooks/useUserProjectTokenHoldings';
import { Link } from 'react-router-dom';
import { formatLargeNumber } from '@/lib/utils';
import { cn } from '@/lib/utils'; // Import cn
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext'; // Import useAppContextDisplayMode

interface UserProjectTokensCardProps {
  tokenHoldings: UserProjectTokenHolding[];
  isLoading: boolean;
  error: string | null;
  isInsideCarousel?: boolean; // Add isInsideCarousel prop
}

export function UserProjectTokensCard({ tokenHoldings, isLoading, error, isInsideCarousel = false }: UserProjectTokensCardProps) {
  const { isMobile } = useAppContextDisplayMode(); // Use useAppContextDisplayMode

  if (isLoading) {
    return (
      <Card className={cn(
        "w-full max-w-md mx-auto mb-8",
        isInsideCarousel && isMobile && "rounded-none border-none max-w-none mx-0 mb-0"
      )}>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={cn(
        "w-full max-w-md mx-auto mb-8",
        isInsideCarousel && isMobile && "rounded-none border-none max-w-none mx-0 mb-0"
      )}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load project token holdings: {error}</AlertDescription>
      </Alert>
    );
  }

  if (tokenHoldings.length === 0) {
    return (
      <Card className={cn(
        "w-full max-w-md mx-auto mb-8",
        isInsideCarousel && isMobile && "rounded-none border-none max-w-none mx-0 mb-0"
      )}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Gem className="h-5 w-5 text-hodl-blue" /> Project Tokens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            This user has not contributed to any projects with associated tokens, or does not hold any.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto mb-8">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Gem className="h-5 w-5 text-hodl-blue" /> Project Tokens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-2 text-sm">
          {tokenHoldings.map((holding) => {
            const amountInAlgos = holding.amount / 1_000_000;
            return (
              <li key={holding.projectId} className="flex justify-between items-center p-2 rounded-md bg-muted/50">
                <Link to={`/project/${holding.projectId}`} className="flex-grow hover:underline">
                  <strong>{holding.projectName}</strong>
                  <span className="block text-xs text-muted-foreground">Asset ID: {holding.assetId}</span>
                </Link>
                <div className="text-right">
                  <p className="font-bold text-primary font-numeric">
                    {formatLargeNumber(amountInAlgos)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Owned
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}