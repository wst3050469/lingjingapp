import paramiko, time
BUILD = '/home/liuhui/lingjing'
f = open(r'D:\lingjing\lingjing\poll_result.txt', 'w', encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Quick check every 5 seconds for up to 10 seconds (bash tool limitation)
for i in range(2):
    time.sleep(5)
    stdin,stdout,stderr = ssh.exec_command('cat /tmp/full-linux-build.log 2>/dev/null | tail -5')
    f.write('Check ' + str(i+1) + ':\n' + stdout.read().decode(errors='replace') + '\n')

stdin,stdout,stderr = ssh.exec_command('ls -la ' + BUILD + '/packages/electron/release/LingJing-1.56.0-linux-x86_64.AppImage 2>/dev/null')
f.write('AppImage:\n' + (stdout.read().decode(errors='replace') or '  building...\n'))

stdin,stdout,stderr = ssh.exec_command('ls -la ' + BUILD + '/packages/electron/release/LingJing-1.56.0-linux-x86_64.deb 2>/dev/null')
f.write('DEB:\n' + (stdout.read().decode(errors='replace') or '  building...\n'))

stdin,stdout,stderr = ssh.exec_command('ps aux | grep -E "electron-builder|fpm" | grep -v grep | wc -l')
f.write('Procs: ' + stdout.read().decode().strip() + '\n')

ssh.close()
f.close()

with open(r'D:\lingjing\lingjing\poll_result.txt', 'r', encoding='utf-8') as fr:
    content = fr.read()
with open(r'D:\lingjing\lingjing\poll_result_ascii.txt', 'w', encoding='ascii', errors='replace') as fa:
    fa.write(content)
