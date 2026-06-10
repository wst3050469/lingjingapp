import { createLogger } from '../monitoring/logger';
import type { FileAssociation } from '@codepilot/core/hw-skill/types';

const logger = createLogger('file-association-manager');

export class FileAssociationManager {
  private associations = new Map<string, FileAssociation>();

  register(associations: FileAssociation[]): void {
    for (const assoc of associations) {
      this.associations.set(assoc.extension, assoc);
      logger.debug('File association registered', { extension: assoc.extension, command: assoc.openCommand });
    }
  }

  unregister(extensions: string[]): void {
    for (const ext of extensions) {
      this.associations.delete(ext);
    }
  }

  resolve(filePath: string): FileAssociation | null {
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    return this.associations.get(ext) ?? null;
  }

  getAll(): FileAssociation[] {
    return [...this.associations.values()];
  }

  canOpen(filePath: string): boolean {
    return this.resolve(filePath) !== null;
  }
}

export const fileAssociationManager = new FileAssociationManager();