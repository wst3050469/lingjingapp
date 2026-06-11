import sys
with open("admin-api.js", "r", encoding="utf-8") as f:
    c = f.read()

old = """      const params = [];
      
      if (status) {
        query += ' WHERE status = ?';
        countQuery += ' WHERE status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY last_seen DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);
      
      const devices = db.prepare(query).all(...params);
      const { total } = db.prepare(countQuery).get(status || null) || { total: 0 };"""

new = """      const params = [];
      const countParams = [];
      
      if (status) {
        query += ' WHERE status = ?';
        countQuery += ' WHERE status = ?';
        params.push(status);
        countParams.push(status);
      }
      
      query += ' ORDER BY last_seen DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);
      
      const devices = db.prepare(query).all(...params);
      const { total } = countParams.length > 0
        ? db.prepare(countQuery).get(...countParams)
        : db.prepare(countQuery).get() || { total: 0 };"""

if old in c:
    c = c.replace(old, new)
    with open("admin-api.js", "w", encoding="utf-8") as f:
        f.write(c)
    print("Fixed devices endpoint")
else:
    print("Could not find the exact text to replace")
    # Debug: show the actual content around that area
    idx = c.find("const params = []")
    if idx >= 0:
        print("Found 'const params = []' at position", idx)
        print("Context:", repr(c[idx:idx+350]))
