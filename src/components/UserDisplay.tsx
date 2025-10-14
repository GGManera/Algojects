"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';

interface UserDisplayProps {
  address: string;
  textSizeClass?: string;
  avatarSizeClass?: string;
}

export function UserDisplay({ address, textSizeClass = 'text-base', avatarSizeClass = 'h-8 w-8' }: UserDisplayProps) {
  // Use a simple heuristic to check if it's a wallet address or a username
  const isAddress = address?.startsWith('0x') && address.length > 10;
  const displayName = isAddress ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : address;
  
  return (
    <div className="flex items-center gap-2">
      <Avatar className={cn(avatarSizeClass)}>
        <AvatarImage src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${address}`} />
        <AvatarFallback>{address ? address.substring(0, 2).toUpperCase() : '??'}</AvatarFallback>
      </Avatar>
      <span className={cn("font-medium", textSizeClass)}>{displayName}</span>
    </div>
  );
}