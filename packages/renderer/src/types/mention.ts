// Mention context types and interfaces

export type MentionType = 'file' | 'folder' | 'attachments' | 'rule';

export interface MentionItem {
  id: string;
  type: MentionType;
  label: string;        // Display name
  path: string;         // File/folder path
  icon?: string;        // Icon type
  content?: string;     // Attachment content preview
  size?: number;        // File size in bytes
  source?: 'active' | 'open' | 'recent' | 'git-changed';  // Recommendation source
}

export interface MentionPosition {
  top: number;
  left: number;
}

export interface MentionDetection {
  show: boolean;
  query: string;
  position: MentionPosition;
  triggerIndex: number; // Index of @ in the text
}

export interface FolderTreeNode {
  path: string;
  name: string;
  isDirectory: boolean;
  children?: FolderTreeNode[];
  isLoading?: boolean;
}

export interface RuleListItem {
  id: string;
  name: string;
  type: 'manual' | 'model' | 'always' | 'filePattern';
  description?: string;
  filePath?: string;
  enabled: boolean;
  source: 'config' | 'file' | 'agents-md';
}

export interface FileSearchResult {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface GitChangedFile {
  name: string;
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
}
