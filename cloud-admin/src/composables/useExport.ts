import { downloadJSON, downloadCSV } from '@/utils/download';

export function useExport() {
  function exportJSON(data: any, filename: string): void {
    downloadJSON(data, filename);
  }

  function exportCSV(data: Record<string, any>[], filename: string): void {
    downloadCSV(data, filename);
  }

  return { exportJSON, exportCSV };
}