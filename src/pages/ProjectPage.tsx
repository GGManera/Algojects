"use client";

import React from 'react';
import { useParams } from 'react-router-dom';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4">Project: {projectId}</h1>
      <p className="text-muted-foreground">
        This is a placeholder page for a single project. Content will be displayed here.
      </p>
    </div>
  );
}