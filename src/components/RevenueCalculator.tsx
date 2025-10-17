"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useSocialData } from "@/hooks/useSocialData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, DollarSign, Users, MessageCircle, FileText, MessageSquare, Heart, Star, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlatformAnalytics } from "@/hooks/usePlatformAnalytics";
import { UserDisplay } from "./UserDisplay";
import { Link } from "react-router-dom";
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAppContextDisplayMode } from '@/contexts/AppDisplayModeContext';
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation"; // NEW Import

const ClickableStat = ({ id, icon, value, onClick, colorClass }: { id: string, icon: React.ReactNode, value: number, onClick: (id: string) => void, colorClass: string }) => {
  return (
    <button
      type="button"
      className="flex items-center gap-2 cursor-pointer p-2 h-10 rounded-md hover:bg-muted/50 transition-colors"
      onClick={() => onClick(id)}
    >
      {/* Clone the icon element and merge the color class */}
      {React.cloneElement(icon as React.ReactElement, { className: cn((icon as React.ReactElement).props.className, colorClass) })}
      {/* Apply colorClass to the value */}
      <span className={cn("font-numeric w-8 text-left", colorClass)}>{value}</span>
    </button>
  );
};

const statDetails: { [key: string]: { title: string; content: React.ReactNode } } = {
  reviews: { title: "Reviews (Writer)", content: <div><p>Review Creator → 1A → AlgoJects</p></div> },
  reviewLikes: { title: "Review Likes (Curator)", content: <div><p>User → 1A → Review Creator</p></div> },
  comments: { title: "Comments (Writer)", content: <div><p>Comment Creator: 0.5A</p><p className="pl-4">↳ 0.25A → Review Creator</p><p className="pl-4">↳ 0.25A → AlgoJects</p></div> },
  commentLikes: { title: "Comment Likes (Curator)", content: <div><p>User: 0.5A</p><p className="pl-4">↳ 0.25A → Comment Creator</p><p className="pl-4">↳ 0.25A → Review Creator</p></div> },
  replies: { title: "Replies (Writer)", content: <div><p>Reply Creator: 0.3A</p><p className="pl-4">↳ 0.1A → Comment Creator</p><p className="pl-4">↳ 0.1A → Review Creator</p><p className="pl-4">↳ 0.1A → AlgoJects</p></div> },
  replyLikes: { title: "Reply Likes (Curator)", content: <div><p>User: 0.3A</p><p className="pl-4">↳ 0.1A → Reply Creator</p><p className="pl-4">↳ 0.1A → Comment Creator</p><p className="pl-4">↳ 0.1A → Review Creator</p></div> },
};

interface RevenueCalculatorProps {
  className?: string;
  isInsideCarousel?: boolean;
  // NEW: Keyboard navigation props
  focusedId: string | null;
  registerItem: ReturnType<typeof useKeyboardNavigation>['registerItem'];
  isActive: boolean;
  setLastActiveId: ReturnType<typeof useKeyboardNavigation>['setLastActiveId'];
}

export function RevenueCalculator({ className, isInsideCarousel = false, focusedId, registerItem, isActive, setLastActiveId }: RevenueCalculatorProps) {
  const { projects, loading: socialDataLoading, error: socialDataError } = useSocialData();
  const { isMobile } = useAppContextDisplayMode();
  const {
    totalReviews,
    totalComments,
    totalReplies,
    totalReviewLikes,
    totalCommentLikes,
    totalReplyLikes,
    platformRevenue,
    totalUserEarnings,
    topWriters,
    topCurators,
    loading: analyticsLoading,
    error: analyticsError,
  } = usePlatformAnalytics(projects);

  const [activeStat, setActiveStat] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // NEW: Keyboard navigation state
  const isFocused = focusedId === 'revenue-calculator';

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeStat) {
      timer = setTimeout(() => {
        setActiveStat(null);
      }, 5000);
    }
    return () => clearTimeout(timer);
  }, [activeStat]);

  const handleStatClick = (statId: string) => {
    setActiveStat(current => (current === statId ? null : statId));
  };

  const handleToggleExpand = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Register item for keyboard navigation
  useEffect(() => {
    const cleanup = registerItem('revenue-calculator', handleToggleExpand, isOpen, 'project-summary');
    return cleanup;
  }, [handleToggleExpand, isOpen, registerItem, isActive]);

  const isLoading = socialDataLoading || analyticsLoading;
  const displayError = socialDataError || analyticsError;

  if (isLoading) {
    return (
      <Card className={cn(
        "w-full",
        !isInsideCarousel && "max-w-3xl mx-auto",
        className
      )}>
        <CardHeader>
          <Skeleton className="h-7 w-1/2 mb-2" />
          <Skeleton className="h-5 w-3/4" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (displayError) {
    return (
      <Alert variant="destructive" className={cn(
        "w-full",
        !isInsideCarousel && "max-w-3xl mx-auto",
        className
      )}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load platform analytics: {displayError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen} 
      className={cn(
        "w-full border-2 border-transparent transition-all duration-200 rounded-lg",
        !isInsideCarousel && "max-w-3xl mx-auto",
        isFocused ? "focus-glow-border" : "",
        !isFocused && "hover:focus-glow-border",
        className
      )}
      data-nav-id="revenue-calculator"
      onMouseEnter={() => setLastActiveId('revenue-calculator')}
      onMouseLeave={() => setLastActiveId(null)}
    >
      <Card className="w-full">
        <CollapsibleTrigger asChild>
          <CardHeader 
            className="flex flex-col items-center justify-center space-y-0 py-4 cursor-pointer relative"
            // Prevent default spacebar action here, as it's handled by the keyboard hook
            onKeyDown={(e) => { if (e.key === ' ') e.preventDefault(); }}
          >
            <CardTitle className="gradient-text">Activity Breakdown</CardTitle>
            <ChevronDown className={cn("h-5 w-5 transition-transform duration-200 absolute right-4 top-1/2 -translate-y-1/2", isOpen ? "rotate-180" : "rotate-0")} />
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg shadow-inner">
                  <DollarSign className="h-8 w-8 text-green-400 mb-2" />
                  <h3 className="text-xl font-bold text-green-400 font-numeric">{platformRevenue.toFixed(1)} ALGO</h3>
                  <p className="text-sm text-muted-foreground">Platform Revenue</p>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg shadow-inner">
                  <Users className="h-8 w-8 text-hodl-blue mb-2" />
                  <h3 className="text-xl font-bold text-hodl-blue font-numeric">{totalUserEarnings.toFixed(1)} ALGO</h3>
                  <p className="text-sm text-muted-foreground">Total User Earnings</p>
                </div>
              </div>

              <div className="border-t md:border-t-0 md:border-l md:pl-6 border-border pt-4 md:pt-0 space-y-2 flex flex-col">
                <h4 className="text-lg font-semibold text-center gradient-text">Posts & Likes</h4>
                <div className="flex-grow flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {activeStat && statDetails[activeStat] ? (
                      <motion.div
                        key="details"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="p-4 bg-muted/50 rounded-lg shadow-inner cursor-pointer w-full"
                        onClick={() => setActiveStat(null)}
                      >
                        <h5 className="text-center font-semibold mb-2">{statDetails[activeStat].title}</h5>
                        <div className="text-sm text-center text-muted-foreground">
                          {statDetails[activeStat].content}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="grid"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "flex flex-col gap-y-1 pt-2 text-sm w-full",
                          !isInsideCarousel && "max-w-sm mx-auto"
                        )}
                      >
                        {/* Header */}
                        <div className="grid grid-cols-[1fr_80px_1fr] items-center">
                          <div className="flex justify-end pr-4">
                            <div className="font-semibold w-[4.5rem] p-2 h-10 flex items-center">Writers</div>
                          </div>
                          <div />
                          <div className="flex justify-start pl-4">
                            <div className="font-semibold w-[4.5rem] p-2 h-10 flex items-center">Curators</div>
                          </div>
                        </div>

                        {/* Reviews Row */}
                        <div className="grid grid-cols-[1fr_80px_1fr] items-center">
                          <div className="flex justify-end border-r border-border pr-4">
                            <ClickableStat
                              id="reviews"
                              icon={<FileText className="h-4 w-4" />}
                              value={totalReviews}
                              onClick={handleStatClick}
                              colorClass="text-gradient-end"
                            />
                          </div>
                          <div className="text-center font-semibold text-gradient-end">Reviews</div>
                          <div className="flex justify-start border-l border-border pl-4">
                            <ClickableStat
                              id="reviewLikes"
                              icon={<Heart className="h-4 w-4" />}
                              value={totalReviewLikes}
                              onClick={handleStatClick}
                              colorClass="text-gradient-end"
                            />
                          </div>
                        </div>

                        {/* Comments Row */}
                        <div className="grid grid-cols-[1fr_80px_1fr] items-center">
                          <div className="flex justify-end border-r border-border pr-4">
                            <ClickableStat
                              id="comments"
                              icon={<MessageCircle className="h-4 w-4" />}
                              value={totalComments}
                              onClick={handleStatClick}
                              colorClass="text-comment-gradient-end"
                            />
                          </div>
                          <div className="text-center font-semibold text-comment-gradient-end">Comments</div>
                          <div className="flex justify-start border-l border-border pl-4">
                            <ClickableStat
                              id="commentLikes"
                              icon={<Heart className="h-4 w-4" />}
                              value={totalCommentLikes}
                              onClick={handleStatClick}
                              colorClass="text-comment-gradient-end"
                            />
                          </div>
                        </div>

                        {/* Replies Row */}
                        <div className="grid grid-cols-[1fr_80px_1fr] items-center">
                          <div className="flex justify-end border-r border-border pr-4">
                            <ClickableStat
                              id="replies"
                              icon={<MessageSquare className="h-4 w-4" />}
                              value={totalReplies}
                              onClick={handleStatClick}
                              colorClass="text-notes-gradient-end"
                            />
                          </div>
                          <div className="text-center font-semibold text-notes-gradient-end">Replies</div>
                          <div className="flex justify-start border-l border-border pl-4">
                            <ClickableStat
                              id="replyLikes"
                              icon={<Heart className="h-4 w-4" />}
                              value={totalReplyLikes}
                              onClick={handleStatClick}
                              colorClass="text-notes-gradient-end"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
              {/* Top Writers Section */}
              <div className="border-t border-border pt-4 space-y-2">
                <h4 className="text-lg font-semibold text-center gradient-text">Top Writers</h4>
                {topWriters.length > 0 ? (
                  <ul className="space-y-2">
                    {topWriters.map((writer, index) => (
                      <li key={writer.address} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="font-numeric text-muted-foreground font-semibold w-4">{index + 1}.</span>
                          <UserDisplay address={writer.address} textSizeClass="text-sm" avatarSizeClass="h-7 w-7" />
                        </div>
                        <Link to={`/profile/${writer.address}`} className="font-bold font-numeric text-green-400 hover:underline">
                          {writer.totalEarnings.toFixed(2)} ALGO
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">No top writers yet.</p>
                )}
              </div>

              {/* Top Curators Section */}
              <div className="mt-6 border-t border-border pt-4 space-y-2 md:mt-0 md:border-t-0 md:border-l md:border-border md:pl-6">
                <h4 className="text-lg font-semibold text-center gradient-text">Top Curators</h4>
                {topCurators.length > 0 ? (
                  <ul className="space-y-2">
                    {topCurators.map((curator, index) => (
                      <li key={curator.address} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <div className="flex items-center gap-2">
                          <span className="font-numeric text-muted-foreground font-semibold w-4">{index + 1}.</span>
                          <UserDisplay address={curator.address} textSizeClass="text-sm" avatarSizeClass="h-7 w-7" />
                        </div>
                        <Link to={`/profile/${curator.address}`} className="font-bold font-numeric text-hodl-blue hover:underline">
                          {(Math.floor(curator.overallCuratorIndex * 10) / 10).toFixed(1)} <Star className="h-4 w-4 inline-block ml-1" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">No top curators yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}