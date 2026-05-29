const fs = require('fs');
const f = 'D:/lingjing/lingjing/packages/core/dist/cloud/sync-client.js';
const exists = fs.existsSync(f);
console.log('sync-client.js exists:', exists);
if (exists) {
  const mtime = fs.statSync(f).mtime;
  const smtime = fs.statSync('D:/lingjing/lingjing/packages/core/src/cloud/sync-client.ts').mtime;
  console.log('dist mtime:', mtime.toISOString());
  console.log('src mtime:', smtime.toISOString());
  console.log('需要重新构建:', smtime > mtime);
}
