import { describe, it, expect } from 'vitest';
import { FileAssociationManager } from '../file-association-manager';

describe('FileAssociationManager', () => {
  const manager = new FileAssociationManager();

  it('should register and resolve file associations', () => {
    manager.register([
      { extension: '.kicad_sch', mimeType: 'application/x-kicad-schematic', openCommand: 'kicad_schematic_edit' },
      { extension: '.scad', mimeType: 'text/x-openscad', openCommand: 'openscad_edit' },
    ]);
    expect(manager.resolve('test.kicad_sch')?.openCommand).toBe('kicad_schematic_edit');
    expect(manager.resolve('model.scad')?.openCommand).toBe('openscad_edit');
    expect(manager.resolve('test.ts')).toBeNull();
  });

  it('should check canOpen', () => {
    expect(manager.canOpen('board.kicad_pcb')).toBe(false);
    expect(manager.canOpen('schematic.kicad_sch')).toBe(true);
  });

  it('should unregister associations', () => {
    manager.unregister(['.scad']);
    expect(manager.resolve('model.scad')).toBeNull();
    expect(manager.resolve('schematic.kicad_sch')?.openCommand).toBe('kicad_schematic_edit');
  });

  it('should list all associations', () => {
    const all = manager.getAll();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });
});