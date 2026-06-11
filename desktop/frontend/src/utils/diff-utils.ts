// Shared diff computation utilities for the Diff Review System
// Extracted from InlineChatDiffRenderer.ts and extended with hunk grouping + partial apply

export interface DiffLine {
  type: 'keep' | 'add' | 'remove';
  text: string;
  /** Original line number (1-based, for 'keep' and 'remove') */
  originalLine?: number;
  /** Modified line number (1-based, for 'keep' and 'add') */
  modifiedLine?: number;
}

export interface DiffHunk {
  id: string;
  diffLines: DiffLine[];
  /** Start line in original content (1-based, inclusive) */
  originalStartLine: number;
  /** End line in original content (1-based, inclusive) */
  originalEndLine: number;
  /** Start line in modified content (1-based, inclusive) */
  modifiedStartLine: number;
  /** End line in modified content (1-based, inclusive) */
  modifiedEndLine: number;
  decision: 'pending' | 'accepted' | 'rejected';
}

const CONTEXT_LINES = 3;

/**
 * Compute line-level diff between original and generated text using LCS.
 * Returns an ordered array of DiffLine entries.
 */
export function computeDiff(originalText: string, generatedText: string): DiffLine[] {
  const origLines = originalText.split('\n');
  const genLines = generatedText.split('\n');

  const m = origLines.length;
  const n = genLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === genLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === genLines[j - 1]) {
      result.push({ type: 'keep', text: origLines[i - 1], originalLine: i, modifiedLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', text: genLines[j - 1], modifiedLine: j });
      j--;
    } else {
      result.push({ type: 'remove', text: origLines[i - 1], originalLine: i });
      i--;
    }
  }

  return result.reverse();
}

/**
 * Group diff lines into hunks with surrounding context.
 * Each hunk contains a contiguous block of changes plus CONTEXT_LINES of surrounding context.
 * Adjacent hunks with <= 2*CONTEXT_LINES gap are merged.
 */
export function computeHunks(beforeContent: string, afterContent: string): DiffHunk[] {
  const diffLines = computeDiff(beforeContent, afterContent);
  if (diffLines.length === 0) return [];

  // Find indices of change lines (non-keep)
  const changeIndices: number[] = [];
  for (let idx = 0; idx < diffLines.length; idx++) {
    if (diffLines[idx].type !== 'keep') {
      changeIndices.push(idx);
    }
  }

  if (changeIndices.length === 0) return [];

  // Group change indices into ranges, merging if gap <= 2*CONTEXT_LINES
  const groups: Array<{ start: number; end: number }> = [];
  let groupStart = changeIndices[0];
  let groupEnd = changeIndices[0];

  for (let k = 1; k < changeIndices.length; k++) {
    if (changeIndices[k] - groupEnd <= 2 * CONTEXT_LINES + 1) {
      groupEnd = changeIndices[k];
    } else {
      groups.push({ start: groupStart, end: groupEnd });
      groupStart = changeIndices[k];
      groupEnd = changeIndices[k];
    }
  }
  groups.push({ start: groupStart, end: groupEnd });

  // Build hunks with context
  const hunks: DiffHunk[] = [];
  for (let g = 0; g < groups.length; g++) {
    const contextStart = Math.max(0, groups[g].start - CONTEXT_LINES);
    const contextEnd = Math.min(diffLines.length - 1, groups[g].end + CONTEXT_LINES);
    const hunkLines = diffLines.slice(contextStart, contextEnd + 1);

    // Determine line ranges from the hunk lines
    let origStart = Infinity, origEnd = 0, modStart = Infinity, modEnd = 0;
    for (const dl of hunkLines) {
      if (dl.originalLine !== undefined) {
        origStart = Math.min(origStart, dl.originalLine);
        origEnd = Math.max(origEnd, dl.originalLine);
      }
      if (dl.modifiedLine !== undefined) {
        modStart = Math.min(modStart, dl.modifiedLine);
        modEnd = Math.max(modEnd, dl.modifiedLine);
      }
    }

    hunks.push({
      id: `hunk-${g}`,
      diffLines: hunkLines,
      originalStartLine: origStart === Infinity ? 1 : origStart,
      originalEndLine: origEnd || 1,
      modifiedStartLine: modStart === Infinity ? 1 : modStart,
      modifiedEndLine: modEnd || 1,
      decision: 'pending',
    });
  }

  return hunks;
}

/**
 * Reconstruct file content by selectively applying accepted hunks.
 * Rejected hunks keep the original lines; accepted hunks apply the modified lines.
 *
 * Algorithm:
 * 1. Walk through the diff lines.
 * 2. Track which hunk each change line belongs to.
 * 3. For accepted hunks: include 'add' lines, exclude 'remove' lines.
 * 4. For rejected hunks: include 'remove' lines (original), exclude 'add' lines.
 * 5. 'keep' lines are always included.
 */
export function applyPartialDiff(
  beforeContent: string,
  afterContent: string,
  hunks: DiffHunk[]
): string {
  const diffLines = computeDiff(beforeContent, afterContent);

  // Build a map from diffLine index → hunk decision
  // First, identify which diff lines belong to which hunk
  const hunkDecisionMap = new Map<number, 'accepted' | 'rejected' | 'pending'>();

  for (const hunk of hunks) {
    for (const hl of hunk.diffLines) {
      if (hl.type === 'keep') continue;
      // Find the matching diff line in the full diff
      for (let idx = 0; idx < diffLines.length; idx++) {
        const dl = diffLines[idx];
        if (dl.type === hl.type && dl.text === hl.text &&
            dl.originalLine === hl.originalLine && dl.modifiedLine === hl.modifiedLine &&
            !hunkDecisionMap.has(idx)) {
          hunkDecisionMap.set(idx, hunk.decision);
          break;
        }
      }
    }
  }

  // Build output
  const output: string[] = [];
  for (let idx = 0; idx < diffLines.length; idx++) {
    const dl = diffLines[idx];
    const decision = hunkDecisionMap.get(idx) || 'accepted'; // default: accepted (keep changes)

    if (dl.type === 'keep') {
      output.push(dl.text);
    } else if (dl.type === 'add') {
      if (decision === 'accepted' || decision === 'pending') {
        output.push(dl.text); // Include new line
      }
      // rejected → skip new line
    } else if (dl.type === 'remove') {
      if (decision === 'rejected') {
        output.push(dl.text); // Keep original line
      }
      // accepted/pending → skip original line (it was removed)
    }
  }

  return output.join('\n');
}
