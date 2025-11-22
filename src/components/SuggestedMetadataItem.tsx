"use client";

import React, { useState, useMemo } from 'react';
import { MetadataItem } from '@/types/project';
import { cn, extractDomainFromUrl, extractXHandleFromUrl } from '@/lib/utils';
import { UserDisplay } from './UserDisplay';
import { Link as LinkIcon, Copy, Gem, UserCircle, X, Edit, Heart, MessageCircle, MessageSquare, FileText, TrendingUp, DollarSign } from "lucide-react";

interface SuggestedMetadataItemProps {
  item: MetadataItem;
  isMobile: boolean;
  className?: string;
}

// Helper function to render individual metadata items (adapted from ProjectMetadataNavigator)
const renderMetadataItem = (
  item: MetadataItem, 
  isMobile: boolean, 
  className?: string
) => {
  // Base classes for centering and max width
  const baseItemClasses = cn(
    "w-full",
    !isMobile && "max-w-[180px] mx-auto"
  );

  const isAssetIdItem = item.type === 'asset-id';
  
  // Determine the text to display on the button
  let buttonText = item.title || "Link";
  let isNumericDisplay = false;

  if (isAssetIdItem) {
    buttonText = item.value;
    isNumericDisplay = true;
  } else if (item.type === 'url') {
    buttonText = item.title || extractDomainFromUrl(item.value);
  } else if (item.type === 'x-url') {
    buttonText = item.title || extractXHandleFromUrl(item.value);
  } else {
    buttonText = item.title || item.value;
  }

  // --- Render Logic ---

  // 1. Render as a Profile Button (URL, X-URL, Asset ID)
  if (item.type === 'url' || item.type === 'x-url' || isAssetIdItem || (item.value.startsWith('http') && !item.type)) {
    return (
      <div
        className={cn("btn-profile pointer-events-none opacity-80", baseItemClasses, className)}
      >
        <strong className={cn("uppercase", isNumericDisplay && "font-numeric !text-base !tracking-normal")}>
          {buttonText}
        </strong>
        <div id="container-stars">
          <div id="stars"></div>
        </div>
        <div id="glow">
          <div className="circle"></div>
          <div className="circle"></div>
        </div>
      </div>
    );
  } 
  
  // 2. Render as a User Display Card (Address)
  else if (item.type === 'address' || item.value.length === 58) {
    return (
      <div 
        className={cn("inline-flex flex-col items-center p-2 rounded-md bg-background/50 border border-border text-center pointer-events-none opacity-80", baseItemClasses, className)} 
      >
        <span className="font-semibold text-muted-foreground text-xs">{item.title || 'Address'}:</span>
        <UserDisplay
          address={item.value}
          textSizeClass="text-sm"
          avatarSizeClass="h-5 w-5"
          linkTo={null} // Disable link
          className="justify-center"
        />
      </div>
    );
  } 
  
  // 3. Render as a Generic Text Card (Text, Asset Unit Name, etc.)
  else {
    return (
      <div 
        className={cn("inline-flex flex-col items-center p-2 rounded-md bg-background/50 border border-border text-center pointer-events-none opacity-80", baseItemClasses, className)} 
      >
        <span className="font-semibold text-muted-foreground text-xs">{item.title}:</span>
        <p className="text-sm text-foreground selectable-text">{item.value}</p>
      </div>
    );
  }
};

export function SuggestedMetadataItem({ item, isMobile, className }: SuggestedMetadataItemProps) {
    return renderMetadataItem(item, isMobile, className);
}