const { execSync } = require('child_process');

function ssh(cmd, timeout = 30000) {
  const full = `ssh -T -o StrictHostKeyChecking=no liuhui@192.168.1.9 ${JSON.stringify(cmd)}`;
  return execSync(full, { timeout, stdio: 'pipe' }).toString();
}

// KILL ALL
console.log('=== Killing ALL processes ===');
ssh('pkill -9 -f electron-builder; pkill -9 -f mksquashfs; pkill -9 -f fpm; pkill -9 -f build-and-upload; echo KILLED');
console.log('Killed');

// CLEAN
console.log('=== Cleaning ===');
ssh('rm -rf /home/liuhui/lingjing/packages/electron/release/linux-unpacked');
ssh('rm -rf /home/liuhui/lingjing/packages/electron/release/__appImage-x64');
ssh('rm -f /home/liuhui/lingjing/packages/electron/release/LingJing-1.73.151*');
ssh('rm -f /home/liuhui/lingjing/packages/electron/release/builder-debug.yml');
console.log('Cleaned');

// VERIFY
console.log('=== Verify clean ===');
const ls = ssh('ls /home/liuhui/lingjing/packages/electron/release/');
console.log('Remaining:', ls);

// START ONE build - foreground with long timeout
console.log('\n=== Starting SINGLE build (will run foreground) ===');
console.log('This may take 5+ minutes...');
