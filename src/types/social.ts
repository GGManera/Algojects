export interface BaseInteraction {
  id: string; // e.g., a.b.c
  sender: string;
  content: string;
  timestamp: number;
  txId: string;
  latestVersion: number;
  likes: Set<string>; // Set of sender addresses who liked
  likeCount: number;
  likeHistory: Array<{ sender: string; action: 'LIKE' | 'UNLIKE'; timestamp: number; txId: string }>; // NEW
  isExcluded: boolean; // NEW: Flag if the post has been excluded/deleted
}

export interface Reply extends BaseInteraction {
  replies?: never;
}

export interface Comment extends BaseInteraction {
  replies: { [replyId: string]: Reply };
}

export interface Review extends BaseInteraction {
  comments: { [commentId: string]: Comment };
}

export interface ProposedNoteEdit extends BaseInteraction {
  projectId: string;
  status: 'pending' | 'accepted' | 'rejected'; // New status for proposed edits
}

export interface Project {
  id: string;
  reviews: { [reviewId: string]: Review };
  creatorWallet?: string; // The sender of the first review (review 'a')
  proposedNoteEdits: { [editId: string]: ProposedNoteEdit }; // NEW: Store proposed note edits
}

export type ProjectsData = {
  [projectId: string]: Project;
};

export interface ProjectDetailsEntry {
  projectId: string;
  projectMetadata: ProjectMetadata; // This will now contain all details
  rowId?: string; // Coda's internal row ID for updates
}