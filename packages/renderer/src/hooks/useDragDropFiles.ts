// useDragDropFiles - handles drag & drop and paste of files into the input area

import { useState, useCallback } from 'react';
import { useContextStore } from '../stores/context-store';
import type { MentionItem } from '../types/mention';

type ContextScope = 'quest' | 'chat';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.pdf', '.docx', '.xlsx', '.xls', '.xmind', '.txt']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

interface UseDragDropFilesOptions {
  onImageAdd?: (file: File) => void;
}

export function useDragDropFiles(scope: ContextScope, options?: UseDragDropFilesOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const selectContext = useContextStore((s) => s.selectContext);

  const handleFile = useCallback((file: File) => {
    const ext = getExtension(file.name);
    // Electron exposes file.path for local files
    const filePath = (file as any).path as string | undefined;

    if (!filePath) return;

    if (IMAGE_EXTENSIONS.has(ext)) {
      // Images handled via callback (for existing image attachment flow)
      options?.onImageAdd?.(file);
    } else if (DOCUMENT_EXTENSIONS.has(ext)) {
      // Documents -> parse as attachments
      const item: MentionItem = {
        id: `drop-${filePath}-${Date.now()}`,
        type: 'attachments',
        label: file.name,
        path: filePath,
        icon: ext.slice(1),
      };
      selectContext(scope, item);
    } else {
      // Code/other files -> add as file context
      const item: MentionItem = {
        id: `drop-${filePath}-${Date.now()}`,
        type: 'file',
        label: file.name,
        path: filePath,
        icon: 'file',
      };
      selectContext(scope, item);
    }
  }, [scope, selectContext, options?.onImageAdd]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      handleFile(files[i]);
    }
  }, [handleFile]);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    // 1) Try clipboardData.files first (file copy-paste from Explorer)
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          // Images via callback
          options?.onImageAdd?.(file);
        } else if ((file as any).path) {
          handleFile(file);
        }
      }
      return;
    }

    // 2) Fallback: screenshots (Win+Shift+S) have NO .files — scan .items for images
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile();
        if (blob) {
          options?.onImageAdd?.(blob);
        }
      }
    }
  }, [handleFile, options?.onImageAdd]);

  return {
    isDragging,
    dragHandlers: { onDragOver, onDragLeave, onDrop },
    pasteHandler: onPaste,
  };
}
