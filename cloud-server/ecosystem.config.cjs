// PM2 Ecosystem Config for LingJing Cloud Server
// Reads .env directly (no dotenv dependency)

const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  const env = {};
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) return;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    });
    console.log('[PM2] Loaded .env:', Object.keys(env).join(', '));
  } catch (e) {
    console.warn('[PM2] Warning: .env file not found:', e.message);
  }
  return env;
}

const envFile = path.join(__dirname, '.env');
const env = loadEnv(envFile);

module.exports = {
  apps: [{
    name: 'cloud-server',
    script: 'server.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      ...env,
    },
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
  }]
};
