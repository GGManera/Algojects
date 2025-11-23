"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Calendar, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserActivityCardProps {
  firstTransactionTimestamp: number | null; // Unix timestamp in seconds
  isLoading: boolean;
}

const calculateDaysSince = (timestamp: number): number => {
  const firstDate = new Date(timestamp * 1000);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - firstDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays;
};

export function UserActivityCard({ firstTransactionTimestamp, isLoading }: UserActivityCardProps) {
  
  const activityData = useMemo(() => {
    if (firstTransactionTimestamp === null || firstTransactionTimestamp === 0) {
      return {
        firstTxDate: 'N/A',
        daysSince: 'N/A',
      };
    }

    const firstTxDate = new Date(firstTransactionTimestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    
    const daysSince = calculateDaysSince(firstTransactionTimestamp);

    return { firstTxDate, daysSince };
  }, [firstTransactionTimestamp]);

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto mb-8 h-fit self-start">
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (activityData.firstTxDate === 'N/A') {
      return (
        <Card className="w-full max-w-md mx-auto mb-8 h-fit self-start">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg gradient-text">Network Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center text-muted-foreground">
                <p className="text-sm">No recent transactions found on Algorand (since 2024).</p>
            </CardContent>
        </Card>
      );
  }

  return (
    <Card className="w-full max-w-md mx-auto mb-8 h-fit self-start">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg gradient-text">Network Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* First Transaction Date */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-hodl-blue" />
            <span className="text-sm font-medium">First Transaction Date</span>
          </div>
          <span className="font-numeric text-sm font-semibold text-foreground">
            {activityData.firstTxDate}
          </span>
        </div>

        {/* Days Since */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-hodl-purple" />
            <span className="text-sm font-medium">Days on Algorand (since 2024)</span>
          </div>
          <span className="font-numeric text-sm font-semibold text-foreground">
            {activityData.daysSince} days
          </span>
        </div>

      </CardContent>
    </Card>
  );
}