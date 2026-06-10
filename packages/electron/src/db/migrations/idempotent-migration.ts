export function idempotentAlterTable(
  db: any,
  table: string,
  column: string,
  type: string,
  defaultClause: string = ''
): void {
  const result = db.exec(`PRAGMA table_info(${table})`);
  const existingColumns = result.length > 0
    ? result[0].values.map((row: any) => row[1] as string)
    : [];

  if (existingColumns.includes(column)) {
    console.log(`[Migration] Column ${table}.${column} already exists, skipping ALTER TABLE`);
    return;
  }

  try {
    const sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${type} ${defaultClause}`.trim();
    db.run(sql);
    console.log(`[Migration] Added column ${table}.${column}`);
  } catch (err) {
    console.warn(`[Migration] ALTER TABLE ${table}.${column} failed (may already exist):`, err);
  }
}