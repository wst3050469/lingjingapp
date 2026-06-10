// Authentication service - user registration, login, JWT token management

import bcrypt from 'bcryptjs';
// jose is ESM-only, loaded dynamically for CJS compatibility
let _jose: typeof import('jose') | null = null;
async function getJose(): Promise<typeof import('jose')> {
  if (!_jose) {
    // Wrap dynamic import with timeout to prevent hanging in broken asar
    _jose = await Promise.race([
      import('jose'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('jose import timed out')), 5000)
      ),
    ]);
  }
  return _jose;
}
import { getDatabase, saveDatabase } from '../db/database.js';

/** Safe JSON parse — prevents "[object Object]" crashes when DB values are already objects */
function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (typeof val !== 'string') return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

const JWT_SECRET = new TextEncoder().encode('codepilot-local-secret-key-change-in-production');
const JWT_ALGORITHM = 'HS256';
const TOKEN_EXPIRY = '7d';

export interface UserRecord {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: UserRecord;
  error?: string;
}

export async function registerUser(username: string, password: string, email?: string): Promise<AuthResult> {
  try {
    const db = getDatabase();

    // Check if user exists
    const existing = db.exec(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return { success: false, error: 'Username already exists' };
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    db.run(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
      [username, email || null, passwordHash],
    );
    await saveDatabase();

    // Get created user
    const result = db.exec(`SELECT id, username, email, created_at FROM users WHERE username = ?`, [username]);
    if (result.length === 0 || result[0].values.length === 0) {
      return { success: false, error: 'Failed to create user' };
    }

    const row = result[0].values[0];
    const user: UserRecord = {
      id: row[0] as number,
      username: row[1] as string,
      email: row[2] as string | null,
      created_at: row[3] as string,
    };

    // Generate JWT
    const token = await generateToken(user);

    return { success: true, token, user };
  } catch (err: any) {
    console.error('[Auth] registerUser error:', err);
    return { success: false, error: String(err?.message || err) };
  }
}

export async function loginUser(username: string, password: string): Promise<AuthResult> {
  try {
    const db = getDatabase();

    const result = db.exec(
      `SELECT id, username, email, password_hash, created_at FROM users WHERE username = ?`,
      [username],
    );

    if (result.length === 0 || result[0].values.length === 0) {
      // No such user — return immediately (common on first launch, not an error)
      return { success: false, error: 'Invalid username or password' };
    }

    const row = result[0].values[0];
    const passwordHash = row[3] as string;

    // bcrypt.compare may hang on some Windows systems due to native module issues
    let valid = false;
    try {
      valid = await Promise.race([
        bcrypt.compare(password, passwordHash),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('bcrypt.compare timed out')), 8000)
        ),
      ]);
    } catch (bcryptErr: any) {
      console.error('[Auth] bcrypt.compare failed:', bcryptErr);
      // Fallback: if bcrypt fails, try direct comparison (for plaintext test passwords)
      valid = (password === passwordHash);
      if (!valid) {
        return { success: false, error: `Authentication service error: ${bcryptErr?.message || 'unknown'}` };
      }
    }

    if (!valid) {
      return { success: false, error: 'Invalid username or password' };
    }

    const user: UserRecord = {
      id: row[0] as number,
      username: row[1] as string,
      email: row[2] as string | null,
      created_at: row[4] as string,
    };

    // generateToken may fail if jose dynamic import hangs
    let token: string;
    try {
      token = await generateToken(user);
    } catch (jwtErr: any) {
      console.error('[Auth] generateToken failed:', jwtErr);
      return { success: false, error: `Token generation error: ${jwtErr?.message || 'unknown'}` };
    }

    return { success: true, token, user };
  } catch (err: any) {
    console.error('[Auth] loginUser error:', err);
    return { success: false, error: String(err?.message || err) };
  }
}

export async function verifyToken(token: string): Promise<UserRecord | null> {
  try {
    const jose = await getJose();
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    });

    return {
      id: payload.userId as number,
      username: payload.username as string,
      email: (payload.email as string) || null,
      created_at: payload.createdAt as string,
    };
  } catch {
    return null;
  }
}

async function generateToken(user: UserRecord): Promise<string> {
  const jose = await getJose();
  return new jose.SignJWT({
    userId: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.created_at,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .setSubject(String(user.id))
    .sign(JWT_SECRET);
}

// Conversation persistence
export async function saveConversation(
  userId: number,
  conversationId: string,
  title: string,
  messages: Array<{ role: string; content: string; toolCalls?: unknown }>,
): Promise<void> {
  const db = getDatabase();

  // Upsert conversation
  db.run(
    `INSERT OR REPLACE INTO conversations (id, user_id, title, updated_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [conversationId, userId, title],
  );

  // Delete old messages for this conversation and re-insert
  db.run(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);

  for (const msg of messages) {
    db.run(
      `INSERT INTO messages (conversation_id, role, content, tool_calls) VALUES (?, ?, ?, ?)`,
      [conversationId, msg.role, msg.content, msg.toolCalls ? JSON.stringify(msg.toolCalls) : null],
    );
  }

  await saveDatabase();
}

export async function loadConversations(userId: number): Promise<Array<{
  id: string;
  title: string;
  updatedAt: string;
}>> {
  const db = getDatabase();
  const result = db.exec(
    `SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`,
    [userId],
  );

  if (result.length === 0) return [];

  return result[0].values.map((row) => ({
    id: row[0] as string,
    title: row[1] as string,
    updatedAt: row[2] as string,
  }));
}

export async function loadConversationMessages(conversationId: string): Promise<Array<{
  role: string;
  content: string;
  toolCalls?: unknown;
}>> {
  const db = getDatabase();
  const result = db.exec(
    `SELECT role, content, tool_calls FROM messages WHERE conversation_id = ? ORDER BY id ASC`,
    [conversationId],
  );

  if (result.length === 0) return [];

  return result[0].values.map((row) => ({
    role: row[0] as string,
    content: row[1] as string,
    toolCalls: safeJsonParse(row[2], undefined),
  }));
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = getDatabase();
  db.run(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);
  db.run(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
  await saveDatabase();
}

export async function renameConversation(conversationId: string, newTitle: string): Promise<void> {
  const db = getDatabase();
  db.run(
    `UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?`,
    [newTitle, conversationId],
  );
  await saveDatabase();
}
