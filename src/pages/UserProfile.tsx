"use client";

import { Link, useNavigate } from "react-router-dom";
import { useSocialData } from "@/hooks/useSocialData";
import { UserDisplay } from "@/components/UserDisplay";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft, TrendingUp, MessageCircle, MessageSquare, Heart } from "lucide-react";
import { Review, Comment, Reply, Project } from "@/types/social";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { GlassRadioGroup, GlassRadioItem } from "@/components/GlassRadioGroup";
import { GlassRadioGroupTwoItems, GlassRadioItemTwoItems } from "@/components/GlassRadioGroupTwoItems";
import { formatTimestamp } from "@/lib/utils";
import { useProjectDetails } from "@/hooks/useProjectDetails";
import { useUserEarnings } from "@/hooks/useUserEarnings";
import { useCuratorIndex } from "@/hooks/useCuratorIndex";
import { useUserProjectTokenHoldings } from "@/hooks/useUserProjectTokenHoldings";
import { UserStatsCard } from "@/components/UserStatsCard";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { useNfd } from '@/hooks/useNfd';
import { useLocation } from "react-router-dom";
import { useAppContextDisplayMode } from "@/contexts/AppDisplayModeContext";
import { cn } from '@/lib/utils';
import { usePlatformAnalytics } from "@/hooks/usePlatformAnalytics";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation"; // NEW Import

// Helper function to calculate interaction score for a review
const getReviewInteractionScore = (review: Review): number => {
  let score = review.likeCount || 0;
  const comments = Object.values(review.comments || {});
  score += comments.length;

  comments.forEach(comment => {
    score += comment.likeCount || 0;
    const replies = Object.values(comment.replies || {});
    score += replies.length;
    replies.forEach(reply => {
      score += reply.likeCount || 0;
    });
  });

  return score;
};

// Helper function to calculate interaction score for a comment
const getCommentInteractionScore = (comment: Comment): number => {
  let score = comment.likeCount || 0;
  const replies = Object.values(comment.replies || {});
  score += replies.length;
  replies.forEach(reply => {
      score += reply.likeCount || 0;
  });
  return score;
};

interface InteractionPreviewProps {
  project: Project;
  projectName: string;
  userProfileAddress: string;
  userProfileNfdName: string | null;
  userProfileActiveCategory: 'writing' | 'curating';
  focusedId: string | null; // NEW
  registerItem: (id: string, toggleExpand: () => void, isExpanded: boolean, type: 'review' | 'comment' | 'reply' | 'project-summary') => () => void; // NEW
  setLastActiveId: ReturnType<typeof useKeyboardNavigation>['setLastActiveId']; // NEW PROP
}

const ReviewItemPreview = ({ review, project, projectName, userProfileAddress, userProfileNfdName, userProfileActiveCategory, focusedId, registerItem, setLastActiveId }: { review: Review } & InteractionPreviewProps) => {
  const interactionScore = getReviewInteractionScore(review);
  const commentsCount = Object.keys(review.comments || {}).length;
  const navigate = useNavigate();
  const { pushEntry } = useNavigationHistory();
  const [isExpanded, setIsExpanded] = useState(false); // Local expansion state
  const isFocused = focusedId === review.id;

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  useEffect(() => {
    const cleanup = registerItem(review.id, handleToggleExpand, isExpanded, 'review');
    return cleanup;
  }, [review.id, handleToggleExpand, isExpanded, registerItem]);

  const handleNavigateToProjectReview = (projectId: string, reviewId: string) => {
    navigate(`/project/${projectId}#review-${reviewId}`);
  };

  return (
    <div
      className={cn(
        "block w-full bg-gradient-to-r from-gradient-start to-gradient-end text-white rounded-lg shadow-none overflow-hidden mb-4 cursor-pointer transition-all duration-200 border-2 border-transparent", // ADDED shadow-none
        "rounded-lg", // ADDED rounded-lg here
        isFocused ? "focus-glow-border" : "",
        !isFocused && "hover:focus-glow-border",
        isExpanded && "shadow-xl"
      )}
      onClick={() => handleNavigateToProjectReview(project.id, review.id.split('.')[1])}
      onMouseEnter={() => setLastActiveId(review.id)} // NEW: Set active ID on mouse enter
      onMouseLeave={() => setLastActiveId(null)} // NEW: Clear active ID on mouse leave
      data-nav-id={review.id} // NEW: Data attribute for keyboard navigation
    >
      <div className="px-3 py-2">
        <div className="flex items-start justify-between mb-2">
          <UserDisplay
            address={review.sender}
            textSizeClass="text-base"
            avatarSizeClass="h-10 w-10"
            onClick={(e) => e.stopPropagation()}
            currentProfileActiveCategory={userProfileActiveCategory}
          />
          <span className="text-xs text-white/70 font-semibold">{formatTimestamp(review.timestamp)}</span>
        </div>
        <p className="whitespace-pre-wrap font-semibold max-h-24 overflow-hidden">{review.content}</p>
      </div>
      <div className="flex justify-around items-center p-2 text-white/70 border-t border-white/20">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span className="font-numeric">{interactionScore}</span>
        </div>
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-5 w-5" />
          <span className="font-numeric">{commentsCount}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Heart className="h-5 w-5" />
          <span className="font-numeric">{review.likeCount || 0}</span>
        </div>
      </div>
    </div>
  );
};

const CommentItemPreview = ({ comment, review, project, projectName, userProfileAddress, userProfileNfdName, userProfileActiveCategory, focusedId, registerItem, setLastActiveId }: { comment: Comment; review: Review } & InteractionPreviewProps) => {
  const interactionScore = getCommentInteractionScore(comment);
  const repliesCount = Object.keys(comment.replies || {}).length;
  const navigate = useNavigate();
  const { pushEntry } = useNavigationHistory();
  const [isExpanded, setIsExpanded] = useState(false); // Local expansion state
  const isFocused = focusedId === comment.id;

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  useEffect(() => {
    const cleanup = registerItem(comment.id, handleToggleExpand, isExpanded, 'comment');
    return cleanup;
  }, [comment.id, handleToggleExpand, isExpanded, registerItem]);

  const handleNavigateToProjectComment = (projectId: string, commentId: string) => {
    navigate(`/project/${projectId}#${commentId}`, {
      state: {
        expandCommentId: commentId,
        highlightCommentId: commentId,
      },
    });
  };

  return (
    <div
      className={cn(
        "block w-full bg-gradient-to-r from-comment-gradient-start/80 to-comment-gradient-end/80 text-white rounded-lg shadow-none overflow-hidden mb-4 cursor-pointer transition-all duration-200 border-2 border-transparent", // ADDED shadow-none
        "rounded-lg", // ADDED rounded-lg here
        isFocused ? "focus-glow-border" : "",
        !isFocused && "hover:focus-glow-border"
      )}
      onClick={() => handleNavigateToProjectComment(project.id, comment.id)}
      onMouseEnter={() => setLastActiveId(comment.id)} // NEW: Set active ID on mouse enter
      onMouseLeave={() => setLastActiveId(null)} // NEW: Clear active ID on mouse leave
      data-nav-id={comment.id} // NEW: Data attribute for keyboard navigation
    >
      <div className="px-3 py-2">
        <div className="flex items-start justify-between mb-2">
          <UserDisplay
            address={comment.sender}
            textSizeClass="text-base"
            avatarSizeClass="h-9 w-9"
            onClick={(e) => e.stopPropagation()}
            currentProfileActiveCategory={userProfileActiveCategory}
          />
          <span className="text-xs text-white/70 font-semibold">{formatTimestamp(comment.timestamp)}</span>
        </div>
        <p className="whitespace-pre-wrap font-semibold max-h-20 overflow-hidden">{comment.content}</p>
        <p className="text-xs text-white/70 mt-2 font-semibold">
          Commented on a review by <UserDisplay
            address={review.sender}
            textSizeClass="text-xs"
            avatarSizeClass="h-6 w-6"
            linkTo={`/project/${project.id}#review-${review.id.split('.')[1]}`}
            onClick={(e) => e.stopPropagation()}
            currentProfileActiveCategory={userProfileActiveCategory}
          />
        </p>
      </div>
      <div className="flex justify-around items-center p-1 text-white/70 border-t border-white/20">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-4 w-4" />
          <span className="font-numeric">{interactionScore}</span>
        </div>
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-4 w-4" />
          <span className="font-numeric">{repliesCount}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Heart className="h-4 w-4" />
          <span className="font-numeric">{comment.likeCount || 0}</span>
        </div>
      </div>
    </div>
  );
};

const ReplyItemPreview = ({ reply, comment, review, project, projectName, userProfileAddress, userProfileNfdName, userProfileActiveCategory, focusedId, registerItem, setLastActiveId }: { reply: Reply; comment: Comment; review: Review } & InteractionPreviewProps) => {
  const navigate = useNavigate();
  const { pushEntry } = useNavigationHistory();
  const [isExpanded, setIsExpanded] = useState(false); // Local expansion state
  const isFocused = focusedId === reply.id;

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  useEffect(() => {
    const cleanup = registerItem(reply.id, handleToggleExpand, isExpanded, 'reply');
    return cleanup;
  }, [reply.id, handleToggleExpand, isExpanded, registerItem]);

  const handleNavigateToProjectReply = (projectId: string, commentId: string, replyId: string) => {
    navigate(`/project/${projectId}#${replyId}`, {
      state: {
        expandCommentId: commentId,
        highlightReplyId: replyId,
      },
    });
  };

  return (
    <div
      className={cn(
        "block w-full bg-gradient-to-r from-notes-gradient-start/90 to-notes-gradient-end/90 text-black rounded-lg shadow-none overflow-hidden mb-4 cursor-pointer transition-all duration-200 border-2 border-transparent", // ADDED shadow-none
        "rounded-lg", // ADDED rounded-lg here
        isFocused ? "focus-glow-border" : "",
        !isFocused && "hover:focus-glow-border"
      )}
      onClick={() => handleNavigateToProjectReply(project.id, comment.id, reply.id)}
      onMouseEnter={() => setLastActiveId(reply.id)} // NEW: Set active ID on mouse enter
      onMouseLeave={() => setLastActiveId(null)} // NEW: Clear active ID on mouse leave
      data-nav-id={reply.id} // NEW: Data attribute for keyboard navigation
    >
      <div className="px-3 py-2">
        <div className="flex items-start justify-between mb-2">
          <UserDisplay
            address={reply.sender}
            textSizeClass="text-sm text-black"
            avatarSizeClass="h-8 w-8"
            onClick={(e) => e.stopPropagation()}
            currentProfileActiveCategory={userProfileActiveCategory}
          />
          <span className="text-xs text-black/70 font-semibold">{formatTimestamp(reply.timestamp)}</span>
        </div>
        <p className="whitespace-pre-wrap text-black font-semibold max-h-16 overflow-hidden">{reply.content}</p>
        <p className="text-xs text-black/70 mt-2 font-semibold">
          Replied to <UserDisplay
            address={comment.sender}
            textSizeClass="text-xs"
            avatarSizeClass="h-6 w-6"
            linkTo={`/project/${project.id}#review-${review.id.split('.')[1]}`}
            onClick={(e) => e.stopPropagation()}
            currentProfileActiveCategory={userProfileActiveCategory}
          />
        </p>
      </div>
      <div className="flex justify-around items-center p-1 text-black/70 border-t border-black/20">
        <div className="flex items-center space-x-2">
          <Heart className="h-4 w-4" />
          <span className="font-numeric">{reply.likeCount || 0}</span>
        </div>
      </div>
    </div>
  );
};

interface UserInteractionGroup {
  project: Project;
  projectName: string;
  reviews: Review[];
  comments: { comment: Comment; review: Review }[];
  replies: { reply: Reply; comment: Comment; review: Review }[];
}

type GroupedUserInteractions = {
  [projectId: string]: UserInteractionGroup;
};

interface UserProfileProps {
  address: string | undefined;
  isInsideCarousel?: boolean;
  scrollToTopTrigger?: number; // NEW prop
  isActive?: boolean; // NEW prop
  onKeyboardModeChange?: (isActive: boolean) => void; // NEW PROP
}

const UserProfile = ({ address, isInsideCarousel = false, scrollToTopTrigger, isActive = false, onKeyboardModeChange }: UserProfileProps) => { // Accept scrollToTopTrigger
  const location = useLocation();
  // Read initialActiveCategory from location.state
  const initialCategoryFromState = (location.state as { initialActiveCategory?: 'writing' | 'curating' })?.initialActiveCategory;

  const { projects, loading: socialDataLoading, error: socialDataError } = useSocialData();
  const { projectDetails, loading: projectDetailsLoading, error: projectDetailsError } = useProjectDetails(); // NEW: Destructure loading and error
  const { userEarnings, loading: earningsLoading } = useUserEarnings(address, projects);
  
  // Use the new useCuratorIndex hook
  const { userCuratorData, loading: curatorIndexLoading, error: curatorIndexError } = useCuratorIndex(address, projects);
  
  // Use usePlatformAnalytics to get amountSpentOnLikes
  const { topWriters, topCurators, loading: analyticsLoading, error: analyticsError } = usePlatformAnalytics(projects);
  const userAnalytics = useMemo(() => {
    if (!address || analyticsLoading) return null;
    return [...topWriters, ...topCurators].find(u => u.address === address);
  }, [address, analyticsLoading, topWriters, topCurators]);
  const userAmountSpentOnLikes = userAnalytics?.amountSpentOnLikes || 0;


  const { tokenHoldings, loading: tokenHoldingsLoading, error: tokenHoldingsError } = useUserProjectTokenHoldings(address, projects, projectDetails);
  const [activeCategory, setActiveCategory] = useState<'writing' | 'curating'>(initialCategoryFromState || "writing");
  const [activeTab, setActiveTab] = useState("reviews");
  const [tabDirection, setTabDirection] = useState(0);
  const prevTabRef = useRef("reviews");

  const [categoryTabDirection, setCategoryTabDirection] = useState(0);
  const prevCategoryRef = useRef("writing");

  const { pushEntry } = useNavigationHistory();
  const { isMobile } = useAppContextDisplayMode();

  const effectiveAddress = address;
  const pageKey = `profile-page-${effectiveAddress}`; // Unique key for navigation hook

  const { nfd: userProfileNfd, loading: nfdLoading } = useNfd(effectiveAddress);

  const scrollRef = useRef<HTMLDivElement>(null);

  // NEW: Initialize keyboard navigation hook, dependent on isActive
  const { focusedId, registerItem, rebuildOrder, setLastActiveId, isKeyboardModeActive } = useKeyboardNavigation(isActive ? pageKey : 'inactive');

  // NEW: Report keyboard mode change up to parent
  useEffect(() => {
    if (isActive && onKeyboardModeChange) {
      onKeyboardModeChange(isKeyboardModeActive);
    }
  }, [isActive, isKeyboardModeActive, onKeyboardModeChange]);

  // NEW: Effect to rebuild order when active or when tab/category changes
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        rebuildOrder();
      }, 100); // Delay to ensure DOM is fully rendered
      return () => clearTimeout(timer);
    }
  }, [isActive, rebuildOrder, activeTab, activeCategory]);

  useEffect(() => {
    if (location.pathname.startsWith('/profile/') && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname]);

  // NEW: Effect to scroll to top when scrollToTopTrigger changes
  useEffect(() => {
    if (scrollToTopTrigger && scrollRef.current && location.pathname.startsWith('/profile/')) {
      console.log("[UserProfile] Scrolling to top due to trigger.");
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollToTopTrigger, location.pathname]);

  // Effect to update history entry with current activeCategory
  useEffect(() => {
    if (effectiveAddress) {
      const path = location.pathname;
      let label = `${effectiveAddress.substring(0, 8)}... Profile`;
      // NEW: Check if projectDetails is loading before trying to find project name
      if (!projectDetailsLoading) {
        label = userProfileNfd?.name || label;
      }
      // Only push if the path is a profile path, and the NFD is loaded (or not loading)
      if (path.startsWith('/profile/') && !nfdLoading) {
        pushEntry({ path, label, activeCategory }); // Push with current activeCategory
      }
    }
  }, [effectiveAddress, location.pathname, userProfileNfd, pushEntry, activeCategory, nfdLoading, projectDetailsLoading]); // NEW: Add projectDetailsLoading dependency

  const isContentLoading = socialDataLoading || projectDetailsLoading || curatorIndexLoading || analyticsLoading; // NEW: Use projectDetailsLoading in combined loading state
  const isContentError = socialDataError || projectDetailsError || curatorIndexError || analyticsError; // NEW: Use projectDetailsError in combined error state

  const tabOrder = {
    "reviews": 0,
    "comments": 1,
    "replies": 2,
  };

  const handleTabChange = (newTab: string) => {
    const oldIndex = tabOrder[prevTabRef.current as keyof typeof tabOrder];
    const newIndex = tabOrder[newTab as keyof typeof tabOrder];

    if (newIndex > oldIndex) {
      setTabDirection(1);
    } else if (newIndex < oldIndex) {
      setTabDirection(-1);
    } else {
      setTabDirection(0);
    }
    setActiveTab(newTab);
    prevTabRef.current = newTab;
  };

  const categoryOrder = {
    "writing": 0,
    "curating": 1,
  };

  const handleCategoryChange = (newCategory: 'writing' | 'curating') => {
    const oldIndex = categoryOrder[prevCategoryRef.current as keyof typeof categoryOrder];
    const newIndex = categoryOrder[newCategory as keyof typeof categoryOrder]; // Corrected type for categoryOrder

    if (newIndex > oldIndex) {
      setCategoryTabDirection(1);
    } else if (newIndex < oldIndex) {
      setCategoryTabDirection(-1);
    } else {
      setCategoryTabDirection(0);
    }
    setActiveCategory(newCategory);
    prevCategoryRef.current = newCategory;
  };

  const groupedUserInteractions = useMemo(() => {
    if (!effectiveAddress || isContentLoading) return {};

    const grouped: GroupedUserInteractions = {};

    const getProjectDisplayName = (projectId: string) => {
      const projectDetailEntry = projectDetails.find(pd => pd.projectId === projectId);
      return projectDetailEntry?.projectMetadata.find(item => item.type === 'project-name')?.value || `Project ${projectId}`;
    };

    Object.values(projects).forEach(project => {
      const projectId = project.id;
      const projectName = getProjectDisplayName(projectId);

      if (!grouped[projectId]) {
        grouped[projectId] = {
          project,
          projectName,
          reviews: [],
          comments: [],
          replies: [],
        };
      }

      Object.values(project.reviews).forEach(review => {
        if (!(review.id.endsWith('.a') && review.content === "")) {
            if (activeCategory === "writing" && review.sender === effectiveAddress) {
              grouped[projectId].reviews.push(review);
            } else if (activeCategory === "curating" && review.likes.has(effectiveAddress)) {
              grouped[projectId].reviews.push(review);
            }
          }
        Object.values(review.comments).forEach(comment => {
          if (activeCategory === "writing" && comment.sender === effectiveAddress) {
            grouped[projectId].comments.push({ comment, review });
          } else if (activeCategory === "curating" && comment.likes.has(effectiveAddress)) {
            grouped[projectId].comments.push({ comment, review });
          }
          Object.values(comment.replies).forEach(reply => {
            if (activeCategory === "writing" && reply.sender === effectiveAddress) {
              grouped[projectId].replies.push({ reply, comment, review });
            } else if (activeCategory === "curating" && reply.likes.has(effectiveAddress)) {
              grouped[projectId].replies.push({ reply, comment, review });
            }
          });
        });
      });
    });

    const filteredGrouped: GroupedUserInteractions = {};
    for (const projectId in grouped) {
      if (grouped[projectId].reviews.length > 0 || grouped[projectId].comments.length > 0 || grouped[projectId].replies.length > 0) {
        filteredGrouped[projectId] = grouped[projectId];
      }
    }

    return filteredGrouped;
  }, [projects, projectDetails, effectiveAddress, activeCategory, isContentLoading]);

  const sortedProjectIds = useMemo(() => {
    return Object.keys(groupedUserInteractions).sort((a, b) => {
      const nameA = groupedUserInteractions[a].projectName.toLowerCase();
      const nameB = groupedUserInteractions[b].projectName.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [groupedUserInteractions]);


  if (!effectiveAddress) {
    return (
        <div className={cn(
          "w-full h-full flex items-center justify-center",
          !isInsideCarousel && "max-w-md mx-auto",
          isInsideCarousel ? "p-0 md:p-0" : "p-2 md:p-4"
        )}>
            <p className="text-muted-foreground">Connect your wallet or select a user to view their profile.</p>
        </div>
    );
  }

  if (isContentError) { // NEW: Use combined error state
    return (
      <div className={cn(
        "w-full",
        !isInsideCarousel && "max-w-md mx-auto",
        isInsideCarousel ? "p-0 md:p-0" : "p-2 md:p-4"
      )}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{isContentError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div id={pageKey} className={cn( // Set pageKey as ID here
      "w-full text-foreground scroll-mt-header-offset",
      !isInsideCarousel && "max-w-md mx-auto",
      isInsideCarousel ? "p-0 md:p-0 h-full" : "p-2 md:p-4 h-full overflow-y-auto"
    )}>
        <AnimatePresence mode="wait">
          <div className="overflow-hidden">
            <motion.div
              key={effectiveAddress}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={isMobile ? "w-full pt-8" : "w-full pt-12"}
            >
              <div className="mb-8 flex flex-col items-center">
                  <UserDisplay
                    address={effectiveAddress}
                    avatarSizeClass="h-28 w-28"
                    textSizeClass="text-2xl text-center"
                    className="flex-col space-y-2"
                    currentProfileActiveCategory={activeCategory}
                  />
              </div>

              <UserStatsCard
                userAddress={effectiveAddress}
                earnings={userEarnings}
                totalLikesGiven={userCuratorData.totalLikesGiven}
                overallCuratorIndex={userCuratorData.overallIndex}
                a1Score={userCuratorData.a1Score}
                a2Score={userCuratorData.a2Score}
                mitigationFactor={userCuratorData.mitigationFactor}
                d1DiversityWriters={userCuratorData.d1DiversityWriters}
                d2DiversityProjects={userCuratorData.d2DiversityProjects}
                d3Recency={userCuratorData.d3Recency}
                amountSpentOnLikes={userAmountSpentOnLikes}
                isLoading={earningsLoading || curatorIndexLoading || analyticsLoading}
                isInsideCarousel={isInsideCarousel}
              />

              <GlassRadioGroupTwoItems defaultValue={activeCategory} onValueChange={handleCategoryChange} className="mb-4">
                  <GlassRadioItemTwoItems value="writing" id="glass-category-writing" label="Writing" />
                  <GlassRadioItemTwoItems value="curating" id="glass-category-curating" label="Curating" />
              </GlassRadioGroupTwoItems>

              <GlassRadioGroup defaultValue="reviews" onValueChange={handleTabChange} className="mb-4">
                  <GlassRadioItem value="reviews" id="glass-silver" label="Reviews" />
                  <GlassRadioItem value="comments" id="glass-gold" label="Comments" />
                  <GlassRadioItem value="replies" id="glass-platinum" label="Replies" />
              </GlassRadioGroup>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, x: categoryTabDirection * 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: categoryTabDirection * 100 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  <div className="mt-4 min-h-[400px] relative">
                    <AnimatePresence mode="wait">
                      {isContentLoading ? (
                        <motion.div
                          key="content-loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-4 w-full"
                        >
                          <Skeleton className="h-32 w-full" />
                          <Skeleton className="h-32 w-full" />
                          <Skeleton className="h-32 w-full" />
                        </motion.div>
                      ) : (
                        <>
                          {activeTab === "reviews" && (
                            <motion.div
                              key="reviews-tab"
                              initial={{ opacity: 0, x: tabDirection * 100 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: tabDirection * 100 }}
                              transition={{ duration: 0.3 }}
                              className="w-full"
                            >
                              {sortedProjectIds.length > 0 ? (
                                  sortedProjectIds.map(projectId => {
                                    const projectGroup = groupedUserInteractions[projectId];
                                    if (projectGroup.reviews.length === 0) return null;
                                    return (
                                      <div key={projectId} className="mb-6">
                                        <Link to={`/project/${projectId}`} className="block hover:underline">
                                          <h3 className="text-xl font-bold gradient-text mb-4">{projectGroup.projectName}</h3>
                                        </Link>
                                        {projectGroup.reviews.map(review => (
                                          <ReviewItemPreview
                                            key={review.id}
                                            review={review}
                                            project={projectGroup.project}
                                            projectName={projectGroup.projectName}
                                            userProfileAddress={effectiveAddress}
                                            userProfileNfdName={userProfileNfd?.name || null}
                                            userProfileActiveCategory={activeCategory}
                                            focusedId={focusedId} // NEW
                                            registerItem={registerItem} // NEW
                                            setLastActiveId={setLastActiveId} // NEW
                                          />
                                        ))}
                                      </div>
                                    );
                                  })
                              ) : (
                                  <p className="text-muted-foreground text-center py-8">
                                    {activeCategory === "writing" ? "This user has not made any reviews." : "This user has not liked any reviews."}
                                  </p>
                              )}
                            </motion.div>
                          )}
                          {activeTab === "comments" && (
                            <motion.div
                              key="comments-tab"
                              initial={{ opacity: 0, x: tabDirection * 100 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: tabDirection * 100 }}
                              transition={{ duration: 0.3 }}
                              className="w-full"
                            >
                              {sortedProjectIds.length > 0 ? (
                                  sortedProjectIds.map(projectId => {
                                    const projectGroup = groupedUserInteractions[projectId];
                                    if (projectGroup.comments.length === 0) return null;
                                    return (
                                      <div key={projectId} className="mb-6">
                                        <Link to={`/project/${projectId}`} className="block hover:underline">
                                          <h3 className="text-xl font-bold gradient-text mb-4">{projectGroup.projectName}</h3>
                                        </Link>
                                        {projectGroup.comments.map(({ comment, review }) => (
                                          <CommentItemPreview
                                            key={comment.id}
                                            comment={comment}
                                            review={review}
                                            project={projectGroup.project}
                                            projectName={projectGroup.projectName}
                                            userProfileAddress={effectiveAddress}
                                            userProfileNfdName={userProfileNfd?.name || null}
                                            userProfileActiveCategory={activeCategory}
                                            focusedId={focusedId} // NEW
                                            registerItem={registerItem} // NEW
                                            setLastActiveId={setLastActiveId} // NEW
                                          />
                                        ))}
                                      </div>
                                    );
                                  })
                              ) : (
                                  <p className="text-muted-foreground text-center py-8">
                                    {activeCategory === "writing" ? "This user has not made any comments." : "This user has not liked any comments."}
                                  </p>
                              )}
                            </motion.div>
                          )}
                          {activeTab === "replies" && (
                            <motion.div
                              key="replies-tab"
                              initial={{ opacity: 0, x: tabDirection * 100 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: tabDirection * 100 }}
                              transition={{ duration: 0.3 }}
                              className="w-full"
                            >
                              {sortedProjectIds.length > 0 ? (
                                  sortedProjectIds.map(projectId => {
                                    const projectGroup = groupedUserInteractions[projectId];
                                    if (projectGroup.replies.length === 0) return null;
                                    return (
                                      <div key={projectId} className="mb-6">
                                        <Link to={`/project/${projectId}`} className="block hover:underline">
                                          <h3 className="text-xl font-bold gradient-text mb-4">{projectGroup.projectName}</h3>
                                        </Link>
                                        {projectGroup.replies.map(({ reply, comment, review }) => (
                                          <ReplyItemPreview
                                            key={reply.id}
                                            reply={reply}
                                            comment={comment}
                                            review={review}
                                            project={projectGroup.project}
                                            projectName={projectGroup.projectName}
                                            userProfileAddress={effectiveAddress}
                                            userProfileNfdName={userProfileNfd?.name || null}
                                            userProfileActiveCategory={activeCategory}
                                            focusedId={focusedId} // NEW
                                            registerItem={registerItem} // NEW
                                            setLastActiveId={setLastActiveId} // NEW
                                          />
                                        ))}
                                      </div>
                                    );
                                  })
                              ) : (
                                  <p className="text-muted-foreground text-center py-8">
                                    {activeCategory === "writing" ? "This user has not made any replies." : "This user has not liked any replies."}
                                  </p>
                              )}
                            </motion.div>
                          )}
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
        </AnimatePresence>
    </div>
  );
};

export default UserProfile;