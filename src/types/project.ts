export interface ProjectMetadataItem {
    type: string;
    value: string;
}

export interface Project {
    projectId: string;
    description: string;
    metadata: ProjectMetadataItem[];
    // Add other necessary project fields here
}