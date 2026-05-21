// Update memory tool - agent-callable persistent memory management
// Uses module-level injection pattern for database access
// Injected dependencies
let _getDatabase = null;
let _saveDatabase = null;
export function initUpdateMemoryTool(getDatabase, saveDatabase) {
    _getDatabase = getDatabase;
    _saveDatabase = saveDatabase;
}
export const updateMemoryTool = {
    name: 'update_memory',
    description: 'Add, search, or delete persistent memories. Memories persist across sessions and help you remember important context about the project, user preferences, and past decisions.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'The action to perform: "add" to create a new memory, "search" to find memories, "delete" to remove a memory by id.',
                enum: ['add', 'search', 'delete'],
            },
            title: {
                type: 'string',
                description: 'Memory title (required for "add")',
            },
            content: {
                type: 'string',
                description: 'Memory content (required for "add")',
            },
            category: {
                type: 'string',
                description: 'Memory category for organization. Default: "general"',
            },
            scope: {
                type: 'string',
                description: 'Memory scope: "global" (all projects) or "project" (current project only). Default: "project"',
                enum: ['global', 'project'],
            },
            query: {
                type: 'string',
                description: 'Search query (for "search" action)',
            },
            id: {
                type: 'string',
                description: 'Memory ID to delete (for "delete" action)',
            },
        },
        required: ['action'],
    },
    async execute(params, context) {
        if (!_getDatabase || !_saveDatabase) {
            return { content: 'Memory system not initialized.', isError: true };
        }
        const action = params.action;
        const scope = params.scope ?? 'project';
        const category = params.category ?? 'general';
        const projectPath = context.workingDirectory;
        try {
            const db = _getDatabase();
            switch (action) {
                case 'add': {
                    const title = params.title;
                    const content = params.content;
                    if (!title || !content) {
                        return { content: 'Error: "title" and "content" are required for "add" action.', isError: true };
                    }
                    // Dedup: check for existing memory with same title in same scope
                    const pPath = scope === 'project' ? projectPath : null;
                    const checkSql = scope === 'global'
                        ? `SELECT id FROM memories WHERE title = ? AND scope = 'global' LIMIT 1`
                        : `SELECT id FROM memories WHERE title = ? AND project_path = ? LIMIT 1`;
                    const checkParams = scope === 'global' ? [title] : [title, pPath];
                    const checkStmt = db.prepare(checkSql);
                    checkStmt.bind(checkParams);
                    if (checkStmt.step()) {
                        // Existing memory found - update instead of insert
                        const existing = checkStmt.getAsObject();
                        const existingId = existing.id;
                        checkStmt.free();
                        db.run(`UPDATE memories SET content = ?, category = ?, updated_at = datetime('now') WHERE id = ?`, [content, category, existingId]);
                        await _saveDatabase();
                        return { content: `Memory updated (dedup). ID: ${existingId}\nTitle: ${title}\nScope: ${scope}\nCategory: ${category}` };
                    }
                    checkStmt.free();
                    // No existing match - insert new
                    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                    db.run(`INSERT INTO memories (id, scope, project_path, category, title, content, source) VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, scope, pPath, category, title, content, 'automatic']);
                    await _saveDatabase();
                    return { content: `Memory added successfully. ID: ${id}\nTitle: ${title}\nScope: ${scope}\nCategory: ${category}` };
                }
                case 'search': {
                    const query = params.query;
                    if (!query) {
                        return { content: 'Error: "query" is required for "search" action.', isError: true };
                    }
                    const stmt = db.prepare(`SELECT id, title, content, category, scope, updated_at FROM memories WHERE (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT 20`);
                    stmt.bind([`%${query}%`, `%${query}%`]);
                    const results = [];
                    while (stmt.step()) {
                        const row = stmt.getAsObject();
                        results.push(`[${row.id}] (${row.category}/${row.scope}) ${row.title}\n  ${row.content.slice(0, 200)}`);
                    }
                    stmt.free();
                    if (results.length === 0) {
                        return { content: `No memories found matching "${query}".` };
                    }
                    return { content: `Found ${results.length} memories:\n\n${results.join('\n\n')}` };
                }
                case 'delete': {
                    const id = params.id;
                    if (!id) {
                        return { content: 'Error: "id" is required for "delete" action.', isError: true };
                    }
                    db.run(`DELETE FROM memories WHERE id = ?`, [id]);
                    const changes = db.getRowsModified();
                    await _saveDatabase();
                    if (changes === 0) {
                        return { content: `No memory found with ID "${id}".`, isError: true };
                    }
                    return { content: `Memory "${id}" deleted successfully.` };
                }
                default:
                    return { content: `Unknown action: "${action}". Use "add", "search", or "delete".`, isError: true };
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return { content: `Memory operation failed: ${msg}`, isError: true };
        }
    },
};
//# sourceMappingURL=update-memory.js.map