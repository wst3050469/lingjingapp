import paramiko, time, base64
BUILD = '/home/liuhui/lingjing'
f = open(r'D:\lingjing\lingjing\deb_only_result.txt', 'w', encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Poll every 10s for DEB
for i in range(6):
    time.sleep(10)
    stdin,stdout,stderr = ssh.exec_command('ls -la ' + BUILD + '/packages/electron/release/LingJing-1.56.0-linux-x86_64.deb 2>/dev/null')
    out = stdout.read().decode(errors='replace')
    if out.strip():
        f.write('ITER ' + str(i+1) + ': DEB FOUND!\n')
        f.write(out + '\n')
        
        # Upload immediately
        f.write('Uploading to production...\n')
        cmd = 'scp -o StrictHostKeyChecking=no ' + BUILD + '/packages/electron/release/LingJing-1.56.0-linux-x86_64.deb root@120.55.5.220:/var/www/downloads/'
        stdin,stdout,stderr = ssh.exec_command(cmd, timeout=120)
        err = stderr.read().decode()
        if err: f.write('SCP: ' + err[:200] + '\n')
        else: f.write('SCP OK\n')
        
        # Update configs
        ssh2 = paramiko.SSHClient()
        ssh2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh2.connect('120.55.5.220', username='root', password='WsT13575967132', timeout=10)
        
        stdin,stdout,stderr = ssh2.exec_command('stat -c%s /var/www/downloads/LingJing-1.56.0-linux-x86_64.deb')
        deb_size = stdout.read().decode().strip()
        stdin,stdout,stderr = ssh2.exec_command('sha256sum /var/www/downloads/LingJing-1.56.0-linux-x86_64.deb | cut -d" " -f1')
        deb_sha = stdout.read().decode().strip()
        
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
            'print("OK")\n'
        )
        encoded = base64.b64encode(py_script.encode()).decode()
        stdin,stdout,stderr = ssh2.exec_command("echo '" + encoded + "' | base64 -d | python3")
        f.write('versions.json: ' + (stdout.read().decode(errors='replace')[:100] or 'error\n'))
        
        linux_yml = ('version: 1.56.0\n'
            'files:\n'
            '  - url: LingJing-1.56.0-linux-x86_64.AppImage\n'
            '    size: 180613708\n'
            '    sha512: 5ba7f00e5aabff4864c7aa9091d79395c11d72d12951f451936c07fad99cbe45\n'
            '  - url: LingJing-1.56.0-linux-x86_64.deb\n'
            '    size: ' + deb_size + '\n'
            'path: LingJing-1.56.0-linux-x86_64.AppImage\n'
            'sha512: 5ba7f00e5aabff4864c7aa9091d79395c11d72d12951f451936c07fad99cbe45\n'
            "releaseDate: '" + now + "'\n")
        encoded2 = base64.b64encode(linux_yml.encode()).decode()
        ssh2.exec_command("echo '" + encoded2 + "' | base64 -d > /var/www/downloads/latest-linux.yml")
        ssh2.exec_command('cp /var/www/downloads/latest-linux.yml /var/www/html/latest-linux.yml')
        f.write('latest-linux.yml updated\n')
        
        ssh2.close()
        f.write('\nDEB FULLY DEPLOYED\n')
        break
    else:
        f.write('ITER ' + str(i+1) + ': no DEB yet (procs: ')
        stdin2,stdout2,stderr2 = ssh.exec_command('ps aux | grep -E "electron-builder|fpm|tar" | grep -v grep | wc -l')
        f.write(stdout2.read().decode().strip() + ')\n')

else:
    f.write('\nDEB not ready after 60s poll\n')
    stdin,stdout,stderr = ssh.exec_command('cat /tmp/full-linux-build.log 2>/dev/null | tail -5')
    f.write('Log:\n' + stdout.read().decode(errors='replace'))

ssh.close()
f.close()

with open(r'D:\lingjing\lingjing\deb_only_result.txt', 'r', encoding='utf-8') as fr:
    content = fr.read()
with open(r'D:\lingjing\lingjing\deb_only_result_ascii.txt', 'w', encoding='ascii', errors='replace') as fa:
    fa.write(content)
