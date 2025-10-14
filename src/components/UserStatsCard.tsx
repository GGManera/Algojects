"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Heart, FileText, MessageCircle, MessageSquare, Star, Clock, Users, LayoutGrid, TrendingUp } from "lucide-react"; // Added Users, LayoutGrid, TrendingUp for D1, D2, A1, A2 icons
import { cn, formatTimestamp } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { ClickableSummaryCard } from "./ClickableSummaryCard";
import { CollapsibleContent } from "./CollapsibleContent"; // ADDED

interface UserStatsCardProps {
  userAddress: string;
  earnings: number;
  totalLikesGiven: number;
  overallCuratorIndex: number;
  a1Score: number; // NEW: A1 Score
  a2Score: number; // NEW: A2 Score
  mitigationFactor: number; // NEW: M Factor
  d1DiversityWriters: number; // NEW: D1
  d2DiversityProjects: number; // NEW: D2
  d3Recency: number; // This now represents D3 (Recency)
  amountSpentOnLikes: number;
  isLoading: boolean;
  isInsideCarousel?: boolean; // Add isInsideCarousel prop
}

export function UserStatsCard({
  userAddress,
  earnings,
  totalLikesGiven,
  overallCuratorIndex,
  a1Score, // NEW
  a2Score, // NEW
  mitigationFactor, // NEW
  d1DiversityWriters, // NEW
  d2DiversityProjects, // NEW
  d3Recency, // This now represents D3 (Recency)
  amountSpentOnLikes,
  isLoading,
  isInsideCarousel = false, // Default to false
}: UserStatsCardProps) {
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const { isMobile } = useAppContextDisplayMode(); // Use useAppContextDisplayMode

  const handleDetailClick = (id: string) => {
    setExpandedDetail(prev => (prev === id ? null : id));
  };

  const totalActivity = earnings + amountSpentOnLikes;
  let writerPercentage = 0;
  let curatorPercentage = 0;

  if (totalActivity > 0) {
    writerPercentage = (earnings / totalActivity) * 100;
    curatorPercentage = (amountSpentOnLikes / totalActivity) * 100;
  } else {
    writerPercentage = 50;
    curatorPercentage = 50;
  }

  if (isLoading) {
    return (
      <Card className={cn(
        "w-full max-w-md mx-auto mb-8 h-fit self-start",
        isInsideCarousel && isMobile && "rounded-none border-none max-w-none mx-0 mb-0"
      )}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto mb-8 h-fit self-start">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">User Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <ClickableSummaryCard
            id="earnings"
            icon={<DollarSign className="h-6 w-6 text-green-400" />}
            title="Total Earnings"
            value={`${earnings.toFixed(2)} ALGO`}
            onClick={handleDetailClick}
            isActive={expandedDetail === 'earnings'}
          />
          <ClickableSummaryCard
            id="likesGiven"
            icon={<Heart className="h-6 w-6 text-pink-400" />}
            title="Likes Given"
            value={totalLikesGiven.toString()}
            onClick={handleDetailClick}
            isActive={expandedDetail === 'likesGiven'}
          />
          <ClickableSummaryCard
            id="curatorIndex"
            icon={<Star className="h-6 w-6 text-hodl-blue" />}
            title="Curator Index"
            value={overallCuratorIndex.toFixed(2)}
            onClick={handleDetailClick}
            isActive={expandedDetail === 'curatorIndex'}
          />
          <ClickableSummaryCard
            id="writerCurator"
            icon={<div className="flex items-center"><FileText className="h-5 w-5 text-hodl-blue" /><Heart className="h-5 w-5 text-pink-400" /></div>}
            title="W/C Balance"
            value={`${writerPercentage.toFixed(0)}% / ${curatorPercentage.toFixed(0)}%`}
            onClick={handleDetailClick}
            isActive={expandedDetail === 'writerCurator'}
          />
        </div>

        <CollapsibleContent isOpen={expandedDetail === 'earnings'} className="p-4 bg-muted/30 rounded-lg mt-4">
          <h4 className="text-md font-semibold mb-2">Total Earnings Breakdown</h4>
          <p className="text-sm text-muted-foreground">
            This section would show a detailed breakdown of how the {earnings.toFixed(2)} ALGO were earned (e.g., from reviews, comments, replies, and likes on your content).
            (Details to be implemented later if requested)
          </p>
        </CollapsibleContent>
        
        <CollapsibleContent isOpen={expandedDetail === 'likesGiven'} className="p-4 bg-muted/30 rounded-lg mt-4">
          <h4 className="text-md font-semibold mb-2">Likes Given Breakdown</h4>
          {totalLikesGiven > 0 ? (
            <p className="text-sm text-muted-foreground text-center">
              This user has given {totalLikesGiven} likes across various content.
              (Detailed breakdown by content type to be implemented later if requested)
            </p>
          ) : (
            <p className="text-sm text-muted-foreground text-center">No likes given yet.</p>
          )}
        </CollapsibleContent>

        <CollapsibleContent isOpen={expandedDetail === 'curatorIndex'} className="p-4 bg-muted/30 rounded-lg mt-4">
          <h4 className="text-md font-semibold mb-2">Curator Index Details</h4>
          <p className="text-2xl font-bold font-numeric text-hodl-blue mb-2">
            {overallCuratorIndex.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            The Curator Index is a sophisticated metric reflecting a user's predictive curatorial ability,
            influenced by the quality of content they like and their consistent, diverse engagement.
          </p>

          <div className="space-y-3 text-sm">
            <h5 className="font-semibold gradient-text">Amplification (A)</h5>
            <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-hodl-blue" />
                <span>A₁ (Predictive)</span>
              </div>
              <span className="font-numeric font-bold">{a1Score.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-hodl-blue" />
                <span>A₂ (Influence)</span>
              </div>
              <span className="font-numeric font-bold">{a2Score.toFixed(2)}</span>
            </div>

            <h5 className="font-semibold gradient-text mt-4">Mitigation (M)</h5>
            <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-hodl-purple" />
                <span>D₁ (Writer Diversity)</span>
              </div>
              <span className="font-numeric font-bold">{d1DiversityWriters.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-hodl-purple" />
                <span>D₂ (Project Diversity)</span>
              </div>
              <span className="font-numeric font-bold">{d2DiversityProjects.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-background/50">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-hodl-purple" />
                <span>D₃ (Recency)</span>
              </div>
              <span className="font-numeric font-bold">{d3Recency.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-background/50 font-bold">
              <span>M (Mitigation Factor)</span>
              <span className="font-numeric">{mitigationFactor.toFixed(2)}</span>
            </div>
          </div>
        </CollapsibleContent>

        <CollapsibleContent isOpen={expandedDetail === 'writerCurator'} className="p-4 bg-muted/30 rounded-lg mt-4">
          <h4 className="text-md font-semibold mb-2">Writer / Curator Balance Details</h4>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-hodl-blue">Writer</span>
            <span className="font-semibold text-pink-400">Curator</span>
          </div>
          <div className="relative w-full h-8 rounded-full bg-muted overflow-hidden shadow-recessed">
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-gradient-start to-gradient-end transition-all duration-500 ease-out"
              style={{ width: `${writerPercentage}%` }}
            ></div>
            <div
              className="absolute top-0 right-0 h-full rounded-full bg-gradient-to-l from-pink-400 to-pink-600 transition-all duration-500 ease-out"
              style={{ width: `${curatorPercentage}%` }}
            ></div>
            <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-bold text-white z-10">
              <span className={cn(
                  "transition-opacity duration-300",
                  writerPercentage < 10 && "opacity-0"
              )}>{writerPercentage.toFixed(0)}%</span>
              <span className={cn(
                  "transition-opacity duration-300",
                  curatorPercentage < 10 && "opacity-0"
              )}>{curatorPercentage.toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span className="font-numeric">{earnings.toFixed(2)} ALGO Earned</span>
            <span className="font-numeric">{amountSpentOnLikes.toFixed(2)} ALGO Spent on Likes</span>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            This bar visualizes the balance between ALGO earned from content creation (Writer) and ALGO spent on liking others' content (Curator).
          </p>
        </CollapsibleContent>
      </CardContent>
    </Card>
  );
}