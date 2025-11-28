export interface MetadataItem {
  title: string;
  value: string;
  type?: 'url' | 'x-url' | 'asset-id' | 'address' | 'text' | 'project-name' | 'project-description' | 'whitelisted-editors' | 'is-creator-added' | 'added-by-address' | 'is-community-notes' | 'tags' | 'is-claimed' | 'project-wallet' | 'asset-unit-name' | 'roadmap-data'; // Added 'roadmap-data'
}

export type ProjectMetadata = MetadataItem[];

// NEW: Define the structure for a single roadmap item
export type RoadmapStatus = 'done' | 'in-progress' | 'future';

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  quarter: string; // e.g., Q4 2025
  order: number;
}