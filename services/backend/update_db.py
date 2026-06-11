import sys
sys.path.insert(0, '/home/liuhui/.local/lib/python3.12/site-packages')

with open('/root/cloud-server/db.js', 'r') as f:
    content = f.read()

# 构建安全的表定义
new_tables = """
  // ── WeChat Work authorized users ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS wecom_authorized_users (
      id TEXT PRIMARY KEY,
      userid TEXT NOT NULL UNIQUE,
      name TEXT,
      avatar_url TEXT,
      authorized_at TEXT DEFAULT (datetime('now')),
      last_active_at TEXT
    )
  `);
  // ── WeChat Work messages table ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS wecom_messages (
      id TEXT PRIMARY KEY,
      msg_id TEXT,
      from_user TEXT NOT NULL,
      to_user TEXT,
      msg_type TEXT DEFAULT 'text',
      content TEXT,
      raw_xml TEXT,
      is_from_system INTEGER DEFAULT 0,
      reply_status TEXT DEFAULT 'pending',
      reply_content TEXT,
      replied_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  // Create indexes
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_wecom_messages_from_user ON wecom_messages(from_user)"); } catch(e) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_wecom_messages_created_at ON wecom_messages(created_at)"); } catch(e) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_wecom_messages_reply_status ON wecom_messages(reply_status)"); } catch(e) {}
"""

insert_point = '  // Insert default wecom config if not exist'
content = content.replace(insert_point, new_tables + '\n  ' + insert_point)

with open('/root/cloud-server/db.js', 'w') as f:
    f.write(content)

print("db.js updated")
