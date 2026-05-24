import paramiko, time, base64
BUILD = '/home/liuhui/lingjing'
f = open(r'D:\lingjing\lingjing\full_build.txt', 'w', encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Kill ALL processes
ssh.exec_command('pkill -9 -f electron-builder 2>/dev/null')
ssh.exec_command('pkill -9 -f fpm 2>/dev/null')
ssh.exec_command('pkill -9 -f app-builder 2>/dev/null')
ssh.exec_command('pkill -9 -f tar 2>/dev/null')
time.sleep(3)
f.write('All processes killed\n')

# Clean old linux-unpacked to force fresh build
ssh.exec_command('rm -rf ' + BUILD + '/packages/electron/release/linux-unpacked')
ssh.exec_command('rm -rf ' + BUILD + '/packages/electron/release/__appImage-x64')
f.write('Cleaned old build artifacts\n')

# Rebuild electron main
stdin,stdout,stderr = ssh.exec_command('cd ' + BUILD + '/packages/electron && node scripts/build-main.mjs 2>&1')
f.write('Build main: ' + stdout.read().decode(errors='replace')[:200] + '\n')

# Run full dist:linux in background
f.write('Starting full dist:linux...\n')
cmd = 'cd ' + BUILD + '/packages/electron && nohup bash -c "node scripts/build-main.mjs && node scripts/pre-package.mjs && npx electron-builder build --linux --x64" > /tmp/full-linux-build.log 2>&1 &'
ssh.exec_command(cmd)
time.sleep(10)

stdin,stdout,stderr = ssh.exec_command('cat /tmp/full-linux-build.log 2>/dev/null | tail -10')
f.write('Log:\n' + stdout.read().decode(errors='replace')[:500] + '\n')

f.write('Build PID: ')
stdin,stdout,stderr = ssh.exec_command("ps aux | grep electron-builder | grep -v grep | awk '{print $2}' | head -1")
f.write(stdout.read().decode().strip() + '\n')

ssh.close()
f.close()

with open(r'D:\lingjing\lingjing\full_build.txt', 'r', encoding='utf-8') as fr:
    content = fr.read()
with open(r'D:\lingjing\lingjing\full_build_ascii.txt', 'w', encoding='ascii', errors='replace') as fa:
    fa.write(content)
