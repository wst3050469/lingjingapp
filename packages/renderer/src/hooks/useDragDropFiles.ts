import { useState, useCallback } from 'react';
import { useContextStore } from '../stores/context-store';
import type { MentionItem } from '../types/mention';

type ContextScope = 'quest' | 'chat';

const DOCUMENT_EXTENSIONS = new Set(['.md', '.pdf', '.docx', '.xlsx', '.xls', '.xmind', '.txt', '.doc']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

interface UseDragDropFilesOptions {
  onFileAdd?: (file: File) => void;
}

export function useDragDropFiles(scope: ContextScope, options?: UseDragDropFilesOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const selectContext = useContextStore((s) => s.selectContext);

  const handleFile = useCallback((file: File) => {
    const ext = getExtension(file.name);
    const filePath = (file as any).path as string | undefined;

    if (!filePath) return;

    if (IMAGE_EXTENSIONS.has(ext) || DOCUMENT_EXTENSIONS.has(ext)) {
      options?.onFileAdd?.(file);
    } else {
      const item: MentionItem = {
        id: `drop-${filePath}-${Date.now()}`,
        type: 'file',
        label: file.name,
        path: filePath,
        icon: 'file',
      };
      selectContext(scope, item);
    }
  }, [scope, selectContext, options?.onFileAdd]);

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
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          options?.onFileAdd?.(file);
        } else if ((file as any).path) {
          handleFile(file);
        }
      }
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile();
        if (blob) {
          options?.onFileAdd?.(blob);
        }
      }
    }
  }, [handleFile, options?.onFileAdd]);

  return {
    isDragging,
    dragHandlers: { onDragOver, onDragLeave, onDrop },
    pasteHandler: onPaste,
  };
}
