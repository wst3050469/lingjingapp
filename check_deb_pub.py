import paramiko, time, base64
BUILD = '/home/liuhui/lingjing'
f = open(r'D:\lingjing\lingjing\deb_pub_result.txt', 'w', encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

stdin,stdout,stderr = ssh.exec_command('cat /tmp/deb-pub-never.log 2>/dev/null | tail -15')
log = stdout.read().decode(errors='replace')
f.write('Log:\n' + log[-800:] + '\n')

stdin,stdout,stderr = ssh.exec_command('ls -la ' + BUILD + '/packages/electron/release/LingJing-1.56.0-linux-x86_64.deb 2>/dev/null')
deb = stdout.read().decode(errors='replace')
f.write('DEB:\n' + (deb if deb.strip() else '  not found\n'))

stdin,stdout,stderr = ssh.exec_command('ps aux | grep -E "electron-builder|fpm" | grep -v grep | wc -l')
f.write('Procs: ' + stdout.read().decode().strip() + '\n')

# If DEB exists, upload
if '1.56.0' in deb and 'deb' in deb:
    f.write('\nDEB READY! Uploading to production...\n')
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
    f.write('Size: ' + deb_size + '\n')
    
    now = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
    
    py_script = (
        'import json;'
        'd=json.load(open("/var/www/html/versions.json"));'
        'v=d["versions"][0];'
        'v["files"]["linux-deb"]={"url":"LingJing-1.56.0-linux-x86_64.deb","size":' + deb_size + ',"sha512":"' + deb_sha + '"};'
        'd["files"]["linux-deb"]=v["files"]["linux-deb"];'
        'd["updated"]="' + now + '";'
        'json.dump(d,open("/var/www/html/versions.json","w"),indent=2,ensure_ascii=False);'
        'print("OK")'
    )
    stdin,stdout,stderr = ssh2.exec_command("python3 -c '" + py_script + "'")
    f.write('versions.json: ' + stdout.read().decode(errors='replace')[:100] + '\n')
    
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
    import base64
    encoded = base64.b64encode(linux_yml.encode()).decode()
    ssh2.exec_command("echo '" + encoded + "' | base64 -d > /var/www/downloads/latest-linux.yml")
    ssh2.exec_command('cp /var/www/downloads/latest-linux.yml /var/www/html/latest-linux.yml')
    f.write('latest-linux.yml updated\n')
    ssh2.close()
    f.write('\n=== COMPLETE ===\n')

ssh.close()
f.close()

with open(r'D:\lingjing\lingjing\deb_pub_result.txt', 'r', encoding='utf-8') as fr:
    content = fr.read()
with open(r'D:\lingjing\lingjing\deb_pub_result_ascii.txt', 'w', encoding='ascii', errors='replace') as fa:
    fa.write(content)
