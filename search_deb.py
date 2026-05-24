import paramiko
BUILD = '/home/liuhui/lingjing'
f = open(r'D:\lingjing\lingjing\search_deb.txt', 'w', encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Find any deb files being created (including temp files)
stdin,stdout,stderr = ssh.exec_command('find ' + BUILD + '/packages/electron/release/ -name "*.deb*" -mmin -10 2>/dev/null')
f.write('Recent deb files:\n' + (stdout.read().decode(errors='replace') or '  none\n'))

# Check temp dir for deb fragments
stdin,stdout,stderr = ssh.exec_command('find /tmp -name "*.deb" -mmin -10 2>/dev/null | head -5')
f.write('Temp DEB files:\n' + (stdout.read().decode(errors='replace') or '  none\n'))

# Check if linux-unpacked was rebuilt with proper version
stdin,stdout,stderr = ssh.exec_command("grep -l '1.56.0' " + BUILD + "/packages/electron/release/linux-unpacked/resources/app/package.json 2>/dev/null")
f.write('Version in linux-unpacked:\n' + (stdout.read().decode(errors='replace') or '  1.56.0 not found\n'))

# Check fpm ruby process stack trace (if any)
stdin,stdout,stderr = ssh.exec_command("cat /proc/$(pgrep -f 'fpm-1.9.3' | head -1)/stack 2>/dev/null || echo 'no stack access'")
f.write('FPM stack:\n' + stdout.read().decode(errors='replace')[:500] + '\n')

ssh.close()
f.close()

with open(r'D:\lingjing\lingjing\search_deb.txt', 'r', encoding='utf-8') as fr:
    content = fr.read()
with open(r'D:\lingjing\lingjing\search_deb_ascii.txt', 'w', encoding='ascii', errors='replace') as fa:
    fa.write(content)
