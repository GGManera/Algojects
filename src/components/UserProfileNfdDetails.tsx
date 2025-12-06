"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, Twitter, MessageCircle, Globe, Info, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

interface NfdData {
  name: string | null;
  properties?: {
    userDefined?: {
      bio?: string;
      blueskydid?: string;
    };
    verified?: {
      avatar?: string;
      banner?: string;
      discord?: string;
      twitter?: string;
    };
  };
}

interface UserProfileNfdDetailsProps {
  nfd: NfdData | null;
  loading: boolean;
  address: string;
}

export function UserProfileNfdDetails({ nfd, loading, address }: UserProfileNfdDetailsProps) {
  
  const socialLinks = useMemo(() => {
    const links = [];
    const twitter = nfd?.properties?.verified?.twitter;
    const discord = nfd?.properties?.verified?.discord;
    const bluesky = nfd?.properties?.userDefined?.blueskydid;

    if (twitter) {
      const handle = twitter.startsWith('@') ? twitter.substring(1) : twitter;
      links.push({ 
        icon: <Twitter className="h-5 w-5 text-blue-400" />, 
        label: twitter, 
        url: `https://x.com/${handle}` 
      });
    }
    if (discord) {
      links.push({
        icon: <MessageCircle className="h-5 w-5 text-indigo-400" />,
        label: `Discord linked`,
        url: null
      });
    }
    if (bluesky) {
      links.push({
        icon: <Globe className="h-5 w-5 text-sky-500" />,
        label: 'Bluesky Profile',
        url: `https://bsky.app/profile/${bluesky}`
      });
    }
    return links;
  }, [nfd]);

  const bio = nfd?.properties?.userDefined?.bio;

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto mb-8 h-fit self-start">
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!nfd || (!bio && socialLinks.length === 0)) {
    return (
      <Card className="w-full max-w-md mx-auto mb-8 h-fit self-start">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Info className="h-4 w-4" />
            <p className="text-sm">No NFD bio or verified social links found for this address.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto mb-8 h-fit self-start">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg gradient-text flex items-center gap-2">
          <UserCircle className="h-5 w-5" /> NFD Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bio && (
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-muted-foreground">Bio:</h5>
            <p className="text-sm whitespace-pre-wrap selectable-text">{bio}</p>
          </div>
        )}

        {socialLinks.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-muted-foreground">Social Links:</h5>
            <div className="space-y-2">
              {socialLinks.map((link, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 rounded-md bg-background/50 border border-border">
                  {link.icon}
                  {link.url ? (
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-sm font-medium hover:underline text-primary truncate"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-foreground truncate">{link.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}