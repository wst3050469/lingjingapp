"use strict";
/**
 * Hermes Fusion Integration Patches
 *
 * These patches should be applied to the existing Electron source code.
 *
 * Patch 1: Add fusion IPC registration to Electron main process
 * Patch 2: Add migration003 to database initialization
 * Patch 3: Core index.ts already exports fusion
 */
// === Patch 1: In Electron main process initialization ===
// Find where IPC handlers are registered and add:
/*
import { registerFusionIPC } from './ipc/fusion/register.js';

// In the main process init function (after window creation):
if (mainWindow) {
  registerFusionIPC(mainWindow);
}
*/
// === Patch 2: In database initialization ===
// Find where migrations are imported and run, add:
/*
import { migration003 } from './database/migrations/migration003_hermes_fusion.js';

// After migration002 is run:
if (db) {
  db.exec(migration003);
}
*/
// === Patch 3: Core index.ts (ALREADY DONE) ===
// packages/core/src/index.ts now contains:
// export * as fusion from './fusion/index.js';
console.log('Integration patches ready');
//# sourceMappingURL=integration-patches.js.map