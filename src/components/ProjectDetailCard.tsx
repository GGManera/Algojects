"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ProjectMetadataItem } from '@/types/project'; // Assuming this type exists

interface ProjectDetailCardProps {
  metadata: ProjectMetadataItem[];
  description: string;
}

const ProjectDetailCard: React.FC<ProjectDetailCardProps> = ({ metadata, description }) => {
  
  // 1. Filter out Contributor Notes/Notes
  const contributorNotesItem = metadata.find(item => 
    item.type === 'contributor-notes' || item.type === 'notes'
  );
  
  const filteredMetadata = metadata.filter(item => 
    item.type !== 'contributor-notes' && item.type !== 'notes'
  );

  const contributorNotes = contributorNotesItem?.value || null;

  // Helper function to format metadata value
  const formatValue = (value: string) => {
    if (value.startsWith('http')) {
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-500 hover:underline break-all"
        >
          {value}
        </a>
      );
    }
    return value;
  };

  return (
    <div className="space-y-6">
      {/* Main Description Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Project Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        </CardContent>
      </Card>

      {/* Metadata Card */}
      {filteredMetadata.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMetadata.map((item, index) => (
              <div key={index} className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground capitalize">
                  {item.type.replace(/-/g, ' ')}
                </p>
                <p className="text-base font-normal text-foreground">
                  {formatValue(item.value)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contributor Notes Container (Moved to the end) */}
      {contributorNotes && (
        <Card className="bg-secondary/50 border-l-4 border-primary">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center">
              Contributor Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
              {contributorNotes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProjectDetailCard;