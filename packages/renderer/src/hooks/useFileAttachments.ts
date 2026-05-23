import { useState, useRef, useCallback } from 'react';

export type ParseStatus = 'pending' | 'parsing' | 'success' | 'failed';
export type AttachmentType = 'image' | 'document';

export interface FileAttachment {
  id: string;
  name: string;
  type: AttachmentType;
  path: string;
  size: number;
  dataUrl?: string;
  content?: string;
  parseStatus?: ParseStatus;
  ext?: string;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.txt', '.md', '.doc', '.docx', '.xls', '.xlsx']);
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;

export const ACCEPT_FILTER = 'image/*,.pdf,.txt,.md,.doc,.docx,.xls,.xlsx';

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useFileAttachments() {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const processFile = useCallback(async (file: File): Promise<{ error?: string } | void> => {
    const ext = getExtension(file.name);
    const filePath = (file as any).path as string | undefined;
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const currentTotal = attachments.reduce((sum, a) => sum + a.size, 0);
    if (currentTotal + file.size > MAX_TOTAL_SIZE) {
      return { error: 'FILE_SIZE_EXCEEDED' };
    }

    if (IMAGE_EXTENSIONS.has(ext)) {
      const dataUrl = await readFileAsDataURL(file);
      setAttachments(prev => [...prev, {
        id, name: file.name, type: 'image',
        path: filePath || '', size: file.size,
        dataUrl, ext,
      }]);
    } else if (DOCUMENT_EXTENSIONS.has(ext) && filePath) {
      const attachment: FileAttachment = {
        id, name: file.name, type: 'document',
        path: filePath, size: file.size,
        parseStatus: 'parsing', ext,
      };
      setAttachments(prev => [...prev, attachment]);
      parseDocumentContent(id, filePath);
    } else if (filePath) {
      const attachment: FileAttachment = {
        id, name: file.name, type: 'document',
        path: filePath, size: file.size,
        parseStatus: 'parsing', ext,
      };
      setAttachments(prev => [...prev, attachment]);
      parseDocumentContent(id, filePath);
    }
  }, [attachments]);

  const parseDocumentContent = useCallback(async (id: string, filePath: string) => {
    try {
      const result = await window.electronAPI.context.parseDocument(filePath);
      setAttachments(prev => prev.map(a =>
        a.id === id ? { ...a, content: result.content, parseStatus: 'success' as ParseStatus } : a
      ));
    } catch {
      setAttachments(prev => prev.map(a =>
        a.id === id ? { ...a, parseStatus: 'failed' as ParseStatus } : a
      ));
    }
  }, []);

  const addFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await processFile(file);
    }
    e.target.value = '';
  }, [processFile]);

  const addFileFromFile = useCallback(async (file: File) => {
    await processFile(file);
  }, [processFile]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const images = attachments.filter(a => a.type === 'image');
  const documents = attachments.filter(a => a.type === 'document');
  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);

  return {
    attachments, images, documents, totalSize,
    addFiles, addFileFromFile, removeAttachment, clearAttachments,
    fileInputRef, triggerFileInput,
  };
}
