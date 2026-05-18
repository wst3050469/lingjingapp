// Auto Import Detector - detects when completions reference unimported symbols

import type * as Monaco from 'monaco-editor';

interface ImportSuggestion {
  statement: string;
  insertLine: number;
}

/**
 * Analyzes completion text to detect unimported symbols and suggests import statements.
 * Supports TypeScript/JavaScript, Python, and Go.
 */
export class AutoImportDetector {
  private monaco: typeof Monaco;

  constructor(monacoInstance: typeof Monaco) {
    this.monaco = monacoInstance;
  }

  /**
   * Analyze completion text and generate import suggestions
   */
  detectMissingImports(
    model: Monaco.editor.ITextModel,
    completionText: string
  ): Monaco.languages.InlineCompletion['additionalTextEdits'] {
    const language = model.getLanguageId();
    const fullText = model.getValue();

    let suggestions: ImportSuggestion[] = [];

    switch (language) {
      case 'typescript':
      case 'typescriptreact':
      case 'javascript':
      case 'javascriptreact':
        suggestions = this.detectTSImports(fullText, completionText);
        break;
      case 'python':
        suggestions = this.detectPythonImports(fullText, completionText);
        break;
      case 'go':
        suggestions = this.detectGoImports(fullText, completionText);
        break;
      default:
        return undefined;
    }

    if (suggestions.length === 0) return undefined;

    return suggestions.map((s) => ({
      range: new this.monaco.Range(s.insertLine, 1, s.insertLine, 1),
      text: s.statement + '\n',
    }));
  }

  /**
   * Detect missing TypeScript/JavaScript imports
   */
  private detectTSImports(
    existingCode: string,
    completionText: string
  ): ImportSuggestion[] {
    const suggestions: ImportSuggestion[] = [];

    // Extract identifiers from completion that look like they might be imported
    // Pattern: PascalCase or known API patterns
    const identifiers = new Set<string>();
    const identifierRegex = /\b([A-Z][a-zA-Z0-9]+)\b/g;
    let match;
    while ((match = identifierRegex.exec(completionText)) !== null) {
      identifiers.add(match[1]);
    }

    // Check which are already imported
    const importRegex = /import\s+.*?(?:from\s+['"].*?['"]|['"].*?['"])/g;
    const existingImports = existingCode.match(importRegex) || [];
    const importedSymbols = new Set<string>();

    for (const imp of existingImports) {
      const symbolMatch = imp.match(/\{([^}]+)\}/);
      if (symbolMatch) {
        symbolMatch[1].split(',').forEach((s) => {
          importedSymbols.add(s.trim().split(/\s+as\s+/)[0]);
        });
      }
      const defaultMatch = imp.match(/import\s+([A-Z][a-zA-Z0-9]*)/);
      if (defaultMatch) {
        importedSymbols.add(defaultMatch[1]);
      }
    }

    // Find the last import line for insertion point
    const lines = existingCode.split('\n');
    let lastImportLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s/)) {
        lastImportLine = i + 1;
      }
    }
    const insertLine = lastImportLine > 0 ? lastImportLine + 1 : 1;

    // Filter to symbols not already imported and not defined in the file
    for (const id of identifiers) {
      if (importedSymbols.has(id)) continue;
      // Skip if it looks like it's defined in the file (class/function/const declaration)
      const declRegex = new RegExp(`(?:class|function|const|let|var|type|interface|enum)\\s+${id}\\b`);
      if (declRegex.test(existingCode)) continue;
      // Skip common built-in types
      if (['Array', 'Object', 'String', 'Number', 'Boolean', 'Promise', 'Map', 'Set', 'Error', 'Date', 'RegExp', 'JSON', 'Math', 'console'].includes(id)) continue;

      // We can't know the source module without a language server,
      // so we add a placeholder comment
      suggestions.push({
        statement: `// TODO: import { ${id} } from '...';`,
        insertLine,
      });
    }

    return suggestions;
  }

  /**
   * Detect missing Python imports
   */
  private detectPythonImports(
    existingCode: string,
    completionText: string
  ): ImportSuggestion[] {
    const suggestions: ImportSuggestion[] = [];

    // Common Python modules that might appear in completions
    const knownModules: Record<string, string> = {
      'os': 'import os',
      'sys': 'import sys',
      'json': 'import json',
      'Path': 'from pathlib import Path',
      'datetime': 'import datetime',
      'typing': 'from typing import',
      'Optional': 'from typing import Optional',
      'List': 'from typing import List',
      'Dict': 'from typing import Dict',
      'Tuple': 'from typing import Tuple',
    };

    const importedModules = new Set<string>();
    const importRegex = /(?:^import\s+(\w+)|^from\s+\w+\s+import\s+(.+))/gm;
    let match;
    while ((match = importRegex.exec(existingCode)) !== null) {
      if (match[1]) importedModules.add(match[1]);
      if (match[2]) {
        match[2].split(',').forEach((s) => importedModules.add(s.trim()));
      }
    }

    // Find insertion point (after last import)
    const lines = existingCode.split('\n');
    let lastImportLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^(?:import|from)\s/)) {
        lastImportLine = i + 1;
      }
    }
    const insertLine = lastImportLine > 0 ? lastImportLine + 1 : 1;

    for (const [symbol, importStmt] of Object.entries(knownModules)) {
      if (completionText.includes(symbol) && !importedModules.has(symbol)) {
        suggestions.push({ statement: importStmt, insertLine });
      }
    }

    return suggestions;
  }

  /**
   * Detect missing Go imports
   */
  private detectGoImports(
    existingCode: string,
    completionText: string
  ): ImportSuggestion[] {
    const suggestions: ImportSuggestion[] = [];

    // Common Go packages
    const knownPackages: Record<string, string> = {
      'fmt.': '"fmt"',
      'os.': '"os"',
      'io.': '"io"',
      'strings.': '"strings"',
      'strconv.': '"strconv"',
      'json.': '"encoding/json"',
      'http.': '"net/http"',
      'time.': '"time"',
      'context.': '"context"',
      'log.': '"log"',
      'filepath.': '"path/filepath"',
    };

    // Check existing imports
    const importBlock = existingCode.match(/import\s*\(([\s\S]*?)\)/);
    const importedPkgs = new Set<string>();
    if (importBlock) {
      const imports = importBlock[1].match(/"([^"]+)"/g) || [];
      for (const imp of imports) {
        importedPkgs.add(imp);
      }
    }

    for (const [prefix, pkg] of Object.entries(knownPackages)) {
      if (completionText.includes(prefix) && !importedPkgs.has(pkg)) {
        // Go imports should be added inside the import block
        suggestions.push({
          statement: `\t${pkg}`,
          insertLine: 1, // Will need smarter placement for Go
        });
      }
    }

    return suggestions;
  }
}
