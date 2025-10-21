"use client";

import { useState, useMemo } from 'react';
import { useNfd } from '@/hooks/useNfd';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle, Gem } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn, formatLargeNumber } from '@/lib/utils';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext';
import { motion, AnimatePresence } from 'framer-motion';

interface UserDisplayProps {
  address: string;
  className?: string;
  avatarSizeClass?: string;
  textSizeClass?: string;
  linkTo?: string | null; // Can be null to make it a non-link div
  // New prop to allow parent to explicitly pass an onClick handler
  onClick?: (e: React.MouseEvent) => void;
  // NEW: Context of the page this UserDisplay is on, to be pushed to history
  sourceContext?: { path: string; label: string } | null;
  currentProfileActiveCategory?: 'writing' | 'curating'; // NEW
  // ADDED PROPS for token holding check:
  projectTokenHoldings?: Map<string, number>;
  writerHoldingsLoading?: boolean;
}

export function UserDisplay({ address, className, avatarSizeClass = "h-8 w-8", textSizeClass = "text-sm", linkTo = `/profile/${address}`, onClick, sourceContext, currentProfileActiveCategory, projectTokenHoldings, writerHoldingsLoading }: UserDisplayProps) {
  // --- Hooks called unconditionally at the top level ---
  const { nfd, loading } = useNfd(address);
  const location = useLocation();
  const { pushEntry } = useNavigationHistory();
  
  const [lastCopied, setLastCopied] = useState<'nfd' | 'address' | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  // --- LOGIC FOR TOKEN HOLDING (useMemo must be unconditional) ---
  const currentProjectId = useMemo(() => {
    if (sourceContext?.path.startsWith('/project/')) {
        return sourceContext.path.split('/')[2];
    }
    return null;
  }, [sourceContext]);

  const userHoldsProjectToken = useMemo(() => {
    if (!currentProjectId || !projectTokenHoldings) return false;
    // Check if the user holds any amount of the project token (amount > 0)
    const amount = projectTokenHoldings.get(currentProjectId);
    return (amount || 0) > 0;
  }, [currentProjectId, projectTokenHoldings]);
  // --- END LOGIC ---

  if (loading) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Skeleton className={cn("rounded-full", avatarSizeClass)} />
        <Skeleton className={cn("h-4", textSizeClass === "text-2xl text-center" ? "w-32" : "w-24")} />
      </div>
    );
  }

  let displayName: string;
  let fullDisplayName: string;

  if (nfd?.name) {
    fullDisplayName = nfd.name;
    displayName = nfd.name.endsWith(".algo") ? nfd.name.slice(0, -5) : nfd.name;
  } else {
    displayName = `${address.substring(0, 8)}...`;
    fullDisplayName = address;
  }
  
  const avatarUrl = nfd?.avatar;

  const isOwnProfilePage = location.pathname === `/profile/${address}`;
  const isLink = !!linkTo;

  const handleInternalCopyClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let textToCopy: string;
    let messageToShow: string;
    let nextCopiedState: 'nfd' | 'address';

    if (nfd?.name && (lastCopied === null || lastCopied === 'address')) {
      textToCopy = fullDisplayName;
      messageToShow = `Copied ${fullDisplayName}!`;
      nextCopiedState = 'nfd';
    } else {
      textToCopy = address;
      const truncatedAddress = `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
      messageToShow = `Copied ${truncatedAddress}!`;
      nextCopiedState = 'address';
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedMessage(messageToShow);
      setTimeout(() => {
        setCopiedMessage(null);
      }, 3000);
      setLastCopied(nextCopiedState);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleNavigation = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    } else if (isLink && linkTo && !isOwnProfilePage) {
      if (sourceContext) {
        pushEntry(sourceContext);
      }
    } else if (isOwnProfilePage) {
      handleInternalCopyClick(e);
    }
  };

  const isVertical = className?.includes('flex-col');

  const Wrapper = isLink ? Link : 'div';
  let wrapperProps: any = { title: fullDisplayName };

  if (isLink) {
    wrapperProps.to = linkTo!;
    wrapperProps.onClick = handleNavigation;
    if (linkTo.startsWith('/profile/') && currentProfileActiveCategory) {
      wrapperProps.state = { initialActiveCategory: currentProfileActiveCategory };
    }
  } else {
    if (onClick) {
      wrapperProps.onClick = onClick;
    }
  }

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "inline-flex items-center group",
        !isVertical ? 'space-x-2' : '',
        className,
        (isLink || isOwnProfilePage) && "hover:opacity-80 transition-opacity"
      )}
    >
      <Avatar className={avatarSizeClass}>
        <AvatarImage src={avatarUrl || undefined} alt={displayName} />
        <AvatarFallback>
          <UserCircle className="h-full w-full text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start">
        <div className="flex items-center">
            <AnimatePresence mode="wait">
            {copiedMessage ? (
                <motion.p
                key="copied-message"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={cn(`${textSizeClass} font-semibold truncate`, (isLink || isOwnProfilePage) && "group-hover:underline")}
                >
                {copiedMessage}
                </motion.p>
            ) : (
                <motion.p
                key="display-name"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={cn(`${textSizeClass} font-semibold truncate`, (isLink || isOwnProfilePage) && "group-hover:underline")}
                >
                {displayName}
                </motion.p>
            )}
            </AnimatePresence>
            {userHoldsProjectToken && (
                <Gem className={cn("h-4 w-4 text-hodl-blue ml-1", textSizeClass === "text-2xl text-center" && "h-6 w-6")} title="Project Token Holder" />
            )}
        </div>
      </div>
    </Wrapper>
  );
}