export interface ProjectMetadataItem {
  type: string;
  value: string;
}

export interface ProjectDetails {
  projectId: string;
  description: string;
  projectMetadata: ProjectMetadataItem[];
  // Add other necessary fields here
}