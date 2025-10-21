"use client";

import { useState } from 'react';
import { useNfd } from '@/hooks/useNfd';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle, Gem } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn, formatLargeNumber } from '@/lib/utils';
import { useNavigationHistory } from '@/contexts/NavigationHistoryContext'; // NEW: Import useNavigationHistory
import { motion, AnimatePresence } from 'framer-motion'; // NEW: Import motion and AnimatePresence

interface UserDisplayProps {
  address: string;
  className?: string;
  avatarSizeClass?: string;
  textSizeClass?: string;
  linkTo?: string | null; // Can be null to make it a non-link div
  // Removed projectTokenHoldings and assetUnitName props
  // New prop to allow parent to explicitly pass an onClick handler
  // This will override the default copy behavior on own profile if provided.
  onClick?: (e: React.MouseEvent) => void;
  // NEW: Context of the page this UserDisplay is on, to be pushed to history
  sourceContext?: { path: string; label: string } | null;
  currentProfileActiveCategory?: 'writing' | 'curating'; // NEW
}

export function UserDisplay({ address, className, avatarSizeClass = "h-8 w-8", textSizeClass = "text-sm", linkTo = `/profile/${address}`, onClick, sourceContext, currentProfileActiveCategory }: UserDisplayProps) {
  const { nfd, loading } = useNfd(address);
  const location = useLocation();
  const [lastCopied, setLastCopied] = useState<'nfd' | 'address' | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const { pushEntry } = useNavigationHistory(); // NEW: Use pushEntry

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
    e.preventDefault(); // Prevent default navigation if this handler is attached to a Link
    e.stopPropagation(); // Prevent parent Link/div from triggering

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

  // NEW: Handle navigation and history push
  const handleNavigation = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e); // Prioritize external onClick
    } else if (isLink && linkTo && !isOwnProfilePage) {
      // Only push to history if it's a link and not navigating to the current profile page
      if (sourceContext) {
        pushEntry(sourceContext);
      }
      // The Link component will handle the actual navigation
    } else if (isOwnProfilePage) {
      // If on own profile page, and no external onClick, default to copy
      handleInternalCopyClick(e);
    }
  };

  const isVertical = className?.includes('flex-col');

  const Wrapper = isLink ? Link : 'div';
  let wrapperProps: any = { title: fullDisplayName };

  if (isLink) {
    wrapperProps.to = linkTo!;
    wrapperProps.onClick = handleNavigation; // Use the new combined handler
    // NEW: Pass state to the Link for initialActiveCategory
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
        <AnimatePresence mode="wait"> {/* NEW: AnimatePresence for smooth text switching */}
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
      </div>
    </Wrapper>
  );
}