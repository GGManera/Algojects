export interface MetadataItem {
  title: string;
  value: string;
  type?: 'url' | 'x-url' | 'asset-id' | 'address' | 'text' | 'project-name' | 'project-description' | 'whitelisted-editors' | 'is-creator-added' | 'added-by-address' | 'is-community-notes' | 'tags' | 'is-claimed'; // Added 'is-claimed'
}

export type ProjectMetadata = MetadataItem[];