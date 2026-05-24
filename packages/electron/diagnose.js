// Diagnostic script - run with: node diagnose.js
const { ipcMain } = require('electron');
console.log('=== Cloud IPC Diagnostic ===');
console.log('1. Checking if cloud:connect handler exists...');
// Can't directly check, but we can test require
try {
  const core = require('@codepilot/core');
  console.log('2. @codepilot/core loaded OK');
  console.log('3. CloudSyncClient exists:', typeof core.CloudSyncClient === 'function');
  const c = new core.CloudSyncClient({ deviceId: 'diag-test', isDesktop: true });
  console.log('4. CloudSyncClient created OK');
  console.log('   isDesktop:', c.isDesktop);
  console.log('   has connectWebSocket:', typeof c.connectWebSocket === 'function');
  console.log('   has listDesktops:', typeof c.listDesktops === 'function');
} catch(e) {
  console.error('FAIL: @codepilot/core load failed:', e.message);
  console.error('Stack:', e.stack?.slice(0, 300));
}
console.log('=== End Diagnostic ===');
