/**
 * 管理后台密码初始化脚本
 * 在服务器上创建管理员密码文件
 * 用法：node init-admin-password.js [新密码]
 * 默认密码：admin123
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PASSWORD_FILE = '/root/lingjing-cloud/.admin-password.json';
const DEFAULT_PASSWORD = 'admin123';

async function main() {
  const newPassword = process.argv[2] || DEFAULT_PASSWORD;

  if (newPassword.length < 6) {
    console.error('错误：密码至少需要6个字符');
    process.exit(1);
  }

  const hash = createHash('sha256').update(newPassword).digest('hex');
  const data = {
    hash,
    password: newPassword,
    updated_at: new Date().toISOString(),
    note: '请尽快修改默认密码！',
  };

  // Remove password field from saved file for security
  const saveData = {
    hash,
    updated_at: data.updated_at,
  };

  try {
    const dir = path.dirname(PASSWORD_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('已创建目录:', dir);
    }

    fs.writeFileSync(PASSWORD_FILE, JSON.stringify(saveData, null, 2), 'utf8');
    console.log('========================================');
    console.log('管理员密码初始化完成');
    console.log('用户名:', 'admin');
    console.log('密码:', newPassword);
    console.log('密码文件:', PASSWORD_FILE);
    console.log('========================================');
    console.log('重要: 请登录后立即修改默认密码！');
    process.exit(0);
  } catch (err) {
    console.error('初始化失败:', err.message);
    process.exit(1);
  }
}

main();
