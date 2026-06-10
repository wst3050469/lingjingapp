export function paginatedQuery(db, baseQuery, countQuery, params = [], options = {}) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || options.pageSize || 20));
  const offset = (page - 1) * limit;
  const orderBy = options.orderBy || 'created_at DESC';

  const data = db.prepare(`${baseQuery} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const { total = 0 } = db.prepare(countQuery).get(...params) || {};

  return {
    data,
    pagination: {
      page,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function withTransaction(db, fn) {
  const transaction = db.transaction(fn);
  try {
    return transaction();
  } catch (err) {
    console.error('[DB] Transaction failed:', err.message);
    throw err;
  }
}

export function configureDB(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
}