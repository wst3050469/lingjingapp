import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
let c = fs.readFileSync(resolve(__dirname, 'server.js'), 'utf8');

// The signup uses hashPassword which returns "salt:hash" format
// But the users table has a separate password_salt column
// Fix: extract salt from the hashPassword result and store both

// Find the signup INSERT statement
const oldInsert = "    db.prepare('INSERT INTO users (id, username, email, password_hash, registered_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)')";
const newInsert = "    db.prepare('INSERT INTO users (id, username, email, password_hash, password_salt, registered_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)')";

// Find the signup .run() - there are TWO signup routes (duplicate! Let me fix both)
const oldRun1 = "      .run(id, username, email || '', passwordHash, now, now);";
const newRun1 = "      .run(id, username, email || '', passwordHash.split(':')[1] || passwordHash, passwordHash.split(':')[0] || '', now, now);";

const oldRun2 = "      .run(id, username, email || '', passwordHash, now, now);";
const newRun2 = "      .run(id, username, email || '', passwordHash.split(':')[1] || passwordHash, passwordHash.split(':')[0] || '', now, now);";

let count = 0;
if (c.indexOf(oldInsert) !== -1) {
  c = c.replace(oldInsert, newInsert);
  count++;
}
if (c.indexOf(oldRun1) !== -1) {
  c = c.replace(oldRun1, newRun1);
  count++;
}
// Second occurrence (duplicate signup route)
if (c.indexOf(newRun1) !== -1 && c.indexOf(newRun1) !== c.lastIndexOf(newRun1)) {
  // Already fixed first one, fix the second
  const secondOldRun = "      .run(id, username, email || '', passwordHash, now, now);";
  if (c.indexOf(secondOldRun) !== -1) {
    c = c.replace(secondOldRun, newRun1);
    count++;
  }
}

fs.writeFileSync(resolve(__dirname, 'server.js'), c, 'utf8');
console.log('Fixed signup INSERT. Replaced:', count, 'spots. Length:', c.length);
