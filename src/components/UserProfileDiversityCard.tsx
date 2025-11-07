"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileText, LayoutGrid, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

interface UserProfileDiversityCardProps {
  userProjects: number;
  totalProjects: number;
  userWriters: number;
  totalWriters: number;
  isLoading: boolean;
}

export function UserProfileDiversityCard({
  userProjects,
  totalProjects,
  userWriters,
  totalWriters,
  isLoading,
}: UserProfileDiversityCardProps) {

  const projectDiversityPercentage = totalProjects > 0 ? (userProjects / totalProjects) * 100 : 0;
  const writerDiversityPercentage = totalWriters > 0 ? (userWriters / totalWriters) * 100 : 0;

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto mb-8">
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto mb-8 h-fit self-start">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg gradient-text">Writing Diversity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Project Diversity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-hodl-blue" />
              <span className="text-sm font-medium">Projects Written In</span>
            </div>
            <span className="font-numeric text-sm font-semibold text-hodl-blue">
              {userProjects} / {totalProjects}
            </span>
          </div>
          <Progress value={projectDiversityPercentage} className="h-2 bg-muted/50 [&>div]:bg-hodl-blue" />
          <p className="text-xs text-muted-foreground text-right">
            {projectDiversityPercentage.toFixed(1)}% of platform project diversity
          </p>
        </div>

        {/* Writer Diversity */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gradient-end" />
              <span className="text-sm font-medium">Writers Interacted With</span>
            </div>
            <span className="font-numeric text-sm font-semibold text-gradient-end">
              {userWriters} / {totalWriters}
            </span>
          </div>
          <Progress value={writerDiversityPercentage} className="h-2 bg-muted/50 [&>div]:bg-gradient-end" />
          <p className="text-xs text-muted-foreground text-right">
            {writerDiversityPercentage.toFixed(1)}% of platform writer diversity
          </p>
        </div>

      </CardContent>
    </Card>
  );
}