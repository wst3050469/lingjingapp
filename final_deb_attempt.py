import paramiko, time, base64
BUILD = '/home/liuhui/lingjing'
f = open(r'D:\lingjing\lingjing\final_deb.txt', 'w', encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Kill all
ssh.exec_command('pkill -9 -f electron-builder 2>/dev/null')
ssh.exec_command('pkill -9 -f fpm 2>/dev/null')
ssh.exec_command('pkill -9 -f app-builder 2>/dev/null')
time.sleep(2)
f.write('Cleaned\n')

# Build with deb target ONLY, no AppImage, with a timeout wrapper
# Use 'timeout' command to prevent hanging
cmd = 'cd ' + BUILD + '/packages/electron && node scripts/build-main.mjs && timeout 180 npx electron-builder build --linux deb --x64 --publish=never 2>&1 | tail -10 > /tmp/deb-final-attempt.log'
f.write('Running DEB build with 180s timeout...\n')
stdin,stdout,stderr = ssh.exec_command(cmd, timeout=200)
out = stdout.read().decode(errors='replace')
err = stderr.read().decode(errors='replace')
f.write('Build:\n' + (out[-500:] if len(out) > 500 else out) + '\n')
if err: f.write('ERR: ' + err[-300:] + '\n')

# Check result
stdin,stdout,stderr = ssh.exec_command('ls -la ' + BUILD + '/packages/electron/release/LingJing-1.56.0-linux-x86_64.deb 2>/dev/null')
deb = stdout.read().decode(errors='replace')
f.write('\nDEB:\n' + (deb if deb.strip() else '  not found\n'))

# Also check log
stdin,stdout,stderr = ssh.exec_command('cat /tmp/deb-final-attempt.log 2>/dev/null')
f.write('Log:\n' + stdout.read().decode(errors='replace')[:500] + '\n')

stdin,stdout,stderr = ssh.exec_command('ps aux | grep -E "electron-builder|fpm" | grep -v grep | wc -l')
f.write('Procs: ' + stdout.read().decode().strip() + '\n')

if '1.56.0' in deb:
    f.write('\nDEB SUCCESS! Uploading...\n')
    cmd = 'scp -o StrictHostKeyChecking=no ' + BUILD + '/packages/electron/release/LingJing-1.56.0-linux-x86_64.deb root@120.55.5.220:/var/www/downloads/'
    stdin,stdout,stderr = ssh.exec_command(cmd, timeout=120)
    err = stderr.read().decode()
    if err: f.write('SCP: ' + err[:200] + '\n')
    else: f.write('SCP OK\n')
    
    ssh2 = paramiko.SSHClient()
    ssh2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh2.connect('120.55.5.220', username='root', password='WsT13575967132', timeout=10)
    stdin,stdout,stderr = ssh2.exec_command('stat -c%s /var/www/downloads/LingJing-1.56.0-linux-x86_64.deb')
    deb_size = stdout.read().decode().strip()
    stdin,stdout,stderr = ssh2.exec_command('sha256sum /var/www/downloads/LingJing-1.56.0-linux-x86_64.deb | cut -d" " -f1')
    deb_sha = stdout.read().decode().strip()
    
    # Update versions.json and latest-linux.yml via simple commands
    now = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
    py = ('import json;d=json.load(open("/var/www/html/versions.json"));'
          'v=d["versions"][0];'
          'v["files"]["linux-deb"]={"url":"LingJing-1.56.0-linux-x86_64.deb","size":' + deb_size + ',"sha512":"' + deb_sha + '"};'
          'd["files"]["linux-deb"]=v["files"]["linux-deb"];'
          'd["updated"]="' + now + '";'
          'json.dump(d,open("/var/www/html/versions.json","w"),indent=2);'
          'print("OK")')
    stdin,stdout,stderr = ssh2.exec_command("python3 -c '" + py + "'")
    f.write('configs updated\n')
    ssh2.close()
    f.write('\n=== DEB DEPLOYED ===\n')

ssh.close()
f.close()

with open(r'D:\lingjing\lingjing\final_deb.txt', 'r', encoding='utf-8') as fr:
    content = fr.read()
with open(r'D:\lingjing\lingjing\final_deb_ascii.txt', 'w', encoding='ascii', errors='replace') as fa:
    fa.write(content)
