import paramiko, time, base64
BUILD = '/home/liuhui/lingjing'
f = open(r'D:\lingjing\lingjing\deb_manual.txt', 'w', encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Kill stuck builds
ssh.exec_command('pkill -9 -f electron-builder 2>/dev/null')
ssh.exec_command('pkill -9 -f fpm 2>/dev/null')
time.sleep(2)
f.write('Killed stuck builds\n')

# Check linux-unpacked exists
stdin,stdout,stderr = ssh.exec_command('ls -d ' + BUILD + '/packages/electron/release/linux-unpacked 2>/dev/null && echo YES || echo NO')
if 'NO' in stdout.read().decode():
    f.write('linux-unpacked missing! Need full rebuild.\n')
    # Run full dist:linux but with publish=never
    cmd = 'cd ' + BUILD + '/packages/electron && node scripts/build-main.mjs && node scripts/pre-package.mjs && npx electron-builder build --linux deb --x64 --publish=never 2>&1 | tail -10 > /tmp/deb-manual.log'
    ssh.exec_command(cmd)
    time.sleep(5)
else:
    f.write('linux-unpacked exists\n')
    
    # Build DEB directly using the app-builder fpm binary
    f.write('Running fpm directly...\n')
    
    # First, check what app-builder binary is available
    stdin,stdout,stderr = ssh.exec_command('ls ' + BUILD + '/node_modules/.pnpm/app-builder-bin*/node_modules/app-builder-bin/linux/x64/app-builder 2>/dev/null')
    app_builder_path = stdout.read().decode().strip()
    f.write('app-builder: ' + app_builder_path + '\n')
    
    # Use electron-builder with publish=never and direct deb target
    cmd = 'cd ' + BUILD + '/packages/electron && npx electron-builder build --linux deb --x64 --publish=never 2>&1'
    stdin,stdout,stderr = ssh.exec_command(cmd, timeout=300)
    out = stdout.read().decode(errors='replace')
    f.write('Build output:\n' + out[-500:] + '\n')

# Check result
stdin,stdout,stderr = ssh.exec_command('ls -la ' + BUILD + '/packages/electron/release/LingJing-1.56.0-linux-x86_64.deb 2>/dev/null')
out = stdout.read().decode(errors='replace')
f.write('\nDEB:\n' + (out if out.strip() else '  not found\n'))

ssh.close()

# Upload if DEB found
if '1.56.0' in out and 'deb' in out:
    f.write('\n=== Uploading DEB ===\n')
    ssh2 = paramiko.SSHClient()
    ssh2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh2.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)
    
    cmd = 'scp -o StrictHostKeyChecking=no ' + BUILD + '/packages/electron/release/LingJing-1.56.0-linux-x86_64.deb root@120.55.5.220:/var/www/downloads/'
    stdin,stdout,stderr = ssh2.exec_command(cmd, timeout=120)
    err = stderr.read().decode()
    if err: f.write('SCP: ' + err[:200] + '\n')
    else: f.write('SCP OK\n')
    ssh2.close()
    
    ssh3 = paramiko.SSHClient()
    ssh3.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh3.connect('120.55.5.220', username='root', password='WsT13575967132', timeout=10)
    stdin,stdout,stderr = ssh3.exec_command('stat -c%s /var/www/downloads/LingJing-1.56.0-linux-x86_64.deb')
    deb_size = stdout.read().decode().strip()
    stdin,stdout,stderr = ssh3.exec_command('sha256sum /var/www/downloads/LingJing-1.56.0-linux-x86_64.deb | cut -d" " -f1')
    deb_sha = stdout.read().decode().strip()
    f.write('Size: ' + deb_size + ' SHA256: ' + deb_sha[:20] + '...\n')
    
    now = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
    
    py_script = (
        'import json\n'
        'with open("/var/www/html/versions.json","r") as fh:\n'
        '    d = json.load(fh)\n'
        'v=d["versions"][0]\n'
        'v["files"]["linux-deb"]={"url":"LingJing-1.56.0-linux-x86_64.deb","size":' + deb_size + ',"sha512":"' + deb_sha + '"}\n'
        'd["files"]["linux-deb"]=v["files"]["linux-deb"]\n'
        'd["updated"]="' + now + '"\n'
        'with open("/var/www/html/versions.json","w") as fh:\n'
        '    json.dump(d,fh,indent=2,ensure_ascii=False)\n'
        'print("versions.json updated, linux-deb size:",' + deb_size + ')\n'
    )
    encoded = base64.b64encode(py_script.encode()).decode()
    stdin,stdout,stderr = ssh3.exec_command("echo '" + encoded + "' | base64 -d | python3")
    f.write('versions.json: ' + stdout.read().decode(errors='replace')[:200] + '\n')
    
    linux_yml = ('version: 1.56.0\n'
        'files:\n'
        '  - url: LingJing-1.56.0-linux-x86_64.AppImage\n'
        '    size: 180613708\n'
        '    sha512: 5ba7f00e5aabff4864c7aa9091d79395c11d72d12951f451936c07fad99cbe45\n'
        '  - url: LingJing-1.56.0-linux-x86_64.deb\n'
        '    size: ' + deb_size + '\n'
        '    sha512: ' + deb_sha + '\n'
        'path: LingJing-1.56.0-linux-x86_64.AppImage\n'
        'sha512: 5ba7f00e5aabff4864c7aa9091d79395c11d72d12951f451936c07fad99cbe45\n'
        "releaseDate: '" + now + "'\n")
    encoded2 = base64.b64encode(linux_yml.encode()).decode()
    ssh3.exec_command("echo '" + encoded2 + "' | base64 -d > /var/www/downloads/latest-linux.yml")
    ssh3.exec_command('cp /var/www/downloads/latest-linux.yml /var/www/html/latest-linux.yml')
    f.write('latest-linux.yml updated\n')
    ssh3.close()
    f.write('\n=== ALL DEPLOYMENTS COMPLETE ===\n')

f.close()

with open(r'D:\lingjing\lingjing\deb_manual.txt', 'r', encoding='utf-8') as fr:
    content = fr.read()
with open(r'D:\lingjing\lingjing\deb_manual_ascii.txt', 'w', encoding='ascii', errors='replace') as fa:
    fa.write(content)
