import { useState, useRef, useCallback } from 'react';

export interface AttachedImage {
  name: string;
  dataUrl: string;
  /** MIME type of the file, e.g. "image/png", "application/pdf", "text/plain" */
  mediaType: string;
}

export function useImageAttachments() {
  const [images, setImages] = useState<AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const addImages = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setImages((prev) => [...prev, { name: file.name, dataUrl, mediaType: file.type || 'application/octet-stream' }]);
      };
      // Images: read as data URL (base64). Others: also read as data URL for consistency
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }, []);

  const addImageFromFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImages((prev) => [...prev, { name: file.name || 'attachment', dataUrl, mediaType: file.type || 'application/octet-stream' }]);
    };
    reader.readAsDataURL(file);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => {
    setImages([]);
  }, []);

  return { images, addImages, addImageFromFile, removeImage, fileInputRef, triggerFileInput, clearImages };
}
