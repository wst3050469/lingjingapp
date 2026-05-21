/**
 * Database Migration Patches for Hermes Fusion
 *
 * INJECTION TARGET: packages/electron/src/db/database.ts
 * INJECTION POINT: After `db.run(migration002)` in initDatabase() (line ~320)
 *
 * Current code in database.ts (lines 318-320):
 *   const { migration002 } = await import('./migrations/002-platform-tables');
 *   db.run(migration002);
 *
 * Add immediately after:
 *   const { migration003 } = await import('./migrations/migration003_hermes_fusion');
 *   db.run(migration003);
 *
 *   // OpenSpace Fusion tables
 *   const { getMigration004SQL } = await import(
 *     '@codepilot/core/fusion/integration/patch-database.js'
 *   );
 *   db.run(getMigration004SQL());
 *
 * Or, if migration004 is created as a standalone file:
 *   const { migration004 } = await import('./migrations/migration004_openspace_fusion');
 *   db.run(migration004);
 */
export declare function getMigration003SQL(): string;
export declare function getMigration004SQL(): string;
//# sourceMappingURL=patch-database.d.ts.map