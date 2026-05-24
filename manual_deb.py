import paramiko, time, base64
BUILD = '/home/liuhui/lingjing'
f = open(r'D:\lingjing\lingjing\manual_deb.txt', 'w', encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Kill all
ssh.exec_command('pkill -9 -f electron-builder 2>/dev/null')
ssh.exec_command('pkill -9 -f fpm 2>/dev/null')
time.sleep(2)
f.write('Killed processes\n')

# Check for linux-unpacked
stdin,stdout,stderr = ssh.exec_command('ls -d ' + BUILD + '/packages/electron/release/linux-unpacked 2>/dev/null && echo YES || echo NO')
has_unpacked = 'YES' in stdout.read().decode()

if not has_unpacked:
    f.write('linux-unpacked missing, need to rebuild...\n')
    ssh.exec_command('cd ' + BUILD + '/packages/electron && node scripts/build-main.mjs && node scripts/pre-package.mjs && npx electron-builder build --linux --x64 2>&1 | tail -5 > /tmp/build-appimage.log &')
    time.sleep(3)
    f.write('AppImage build started in background\n')
else:
    f.write('linux-unpacked exists\n')

# Find fpm
stdin,stdout,stderr = ssh.exec_command('find ~/.cache/electron-builder/fpm -name fpm -type f 2>/dev/null | head -1')
fpm_path = stdout.read().decode().strip()
f.write('FPM path: ' + (fpm_path or 'not found') + '\n')

# Find app-builder
stdin,stdout,stderr = ssh.exec_command('find ' + BUILD + '/node_modules -name app-builder -type f 2>/dev/null | head -1')
app_builder = stdout.read().decode().strip()
f.write('App-builder: ' + (app_builder or 'not found') + '\n')

# Check previous deb build commands for reference
stdin,stdout,stderr = ssh.exec_command("ls -la " + BUILD + "/packages/electron/release/LingJing-1.52.12-linux-x86_64.deb")
f.write('Previous DEB:\n' + stdout.read().decode(errors='replace'))

ssh.close()
f.close()

with open(r'D:\lingjing\lingjing\manual_deb.txt', 'r', encoding='utf-8') as fr:
    content = fr.read()
with open(r'D:\lingjing\lingjing\manual_deb_ascii.txt', 'w', encoding='ascii', errors='replace') as fa:
    fa.write(content)
