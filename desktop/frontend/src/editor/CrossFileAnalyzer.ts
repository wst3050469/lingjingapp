// Cross-File Analyzer - detects when changes in one file affect others

import { useNextStore, type PendingEdit } from '../stores/next-store';
import { useEditorStore } from '../stores/editor-store';

/**
 * Analyzes a code change to determine if it impacts other open files.
 * For example, renaming a function in one file should update all call sites.
 */
export async function analyzeCrossFileImpact(change: {
  filePath: string;
  oldText: string;
  newText: string;
}): Promise<PendingEdit[]> {
  const store = useNextStore.getState();
  if (!store.enabled) return [];

  // Get all open files except the one that was changed
  const editorState = useEditorStore.getState();
  const otherFiles = editorState.openFiles.filter(
    (f) => f.path !== change.filePath
  );

  if (otherFiles.length === 0) return [];

  // Quick heuristic: only analyze if the change looks like a rename or signature change
  if (!looksLikeSignificantChange(change.oldText, change.newText)) {
    return [];
  }

  try {
    const relatedFiles = otherFiles.slice(0, 5).map((f) => ({
      filePath: f.path,
      content: f.content,
    }));

    const changeDescription = `Changed "${change.oldText.slice(0, 100)}" to "${change.newText.slice(0, 100)}"`;

    const response = await window.electronAPI.completion.crossFile({
      changedFile: change.filePath,
      changeDescription,
      relatedFiles,
    });

    if (response.error || !response.edits?.length) {
      return [];
    }

    return response.edits.map((edit: any) => ({
      filePath: edit.filePath,
      startLine: edit.startLine,
      endLine: edit.endLine,
      newText: edit.newText,
      description: `Update reference from ${change.filePath.split(/[/\\]/).pop()}`,
    }));
  } catch (err) {
    console.warn('[NEXT] Cross-file analysis failed:', err);
    return [];
  }
}

/**
 * Quick heuristic to determine if a change is "significant" enough
 * to warrant cross-file analysis (e.g., rename, signature change).
 */
function looksLikeSignificantChange(oldText: string, newText: string): boolean {
  // Skip trivial changes
  if (!oldText.trim() || !newText.trim()) return false;
  if (oldText === newText) return false;

  // Check if it looks like a rename (identifier-like strings that differ)
  const identifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  if (identifierRegex.test(oldText.trim()) && identifierRegex.test(newText.trim())) {
    return true;
  }

  // Check if it looks like a function signature change
  if (oldText.includes('(') && newText.includes('(')) {
    return true;
  }

  // Check if it looks like a type/interface change
  if (
    (oldText.includes('interface') || oldText.includes('type') || oldText.includes('class')) &&
    (newText.includes('interface') || newText.includes('type') || newText.includes('class'))
  ) {
    return true;
  }

  return false;
}

/**
 * Process the next pending cross-file edit.
 * Returns the edit that should be applied, or undefined if queue is empty.
 */
export function processNextPendingEdit(): PendingEdit | undefined {
  return useNextStore.getState().consumeNextPendingEdit();
}

/**
 * Check if there are pending cross-file edits
 */
export function hasPendingEdits(): boolean {
  return useNextStore.getState().pendingEdits.length > 0;
}
