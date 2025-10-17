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
          <CardTitle className="text-2xl">Project Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-base text-muted-foreground">{description}</p>
        </CardContent>
      </Card>

      {/* Metadata Card */}
      {filteredMetadata.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMetadata.map((item, index) => (
              <div key={index} className="flex flex-col space-y-1">
                <span className="text-sm font-medium capitalize">
                  {item.type.replace(/-/g, ' ')}:
                </span>
                <span className="text-base text-foreground">
                  {formatValue(item.value)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contributor Notes Container (Moved to the end) */}
      {contributorNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Contributor Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-base text-muted-foreground">
              {contributorNotes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProjectDetailCard;