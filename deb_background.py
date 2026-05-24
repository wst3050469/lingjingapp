import paramiko, time, base64

BUILD = '/home/liuhui/lingjing'
LOG = r'D:\lingjing\lingjing\deb_bg.txt'
f = open(LOG, 'w', encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Kill stuck processes
ssh.exec_command('pkill -9 -f electron-builder 2>/dev/null')
ssh.exec_command('pkill -9 -f fpm 2>/dev/null')
ssh.exec_command('pkill -9 -f app-builder 2>/dev/null')
time.sleep(2)
f.write('Cleaned up\n')

# Start DEB build in background
# Use correct electron-builder format: build --linux deb
cmd = 'cd ' + BUILD + '/packages/electron && nohup npx electron-builder build --linux deb 2>&1 > /tmp/deb-build-156.log & echo PID=$!'
stdin,stdout,stderr = ssh.exec_command(cmd)
pid = stdout.read().decode().strip()
f.write('Started, PID: ' + pid + '\n')

time.sleep(5)
stdin,stdout,stderr = ssh.exec_command('cat /tmp/deb-build-156.log 2>/dev/null | tail -20')
f.write('Log:\n' + (stdout.read().decode(errors='replace') or '  empty\n'))

ssh.close()
f.close()

with open(LOG, 'r', encoding='utf-8') as fr:
    content = fr.read()
with open(LOG.replace('.txt', '_ascii.txt'), 'w', encoding='ascii', errors='replace') as fa:
    fa.write(content)
