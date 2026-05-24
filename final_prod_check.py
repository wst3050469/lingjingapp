import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('120.55.5.220', username='root', password='WsT13575967132', timeout=10)

# 1. Check all download files exist with correct sizes
stdin,stdout,stderr = ssh.exec_command('ls -la /var/www/downloads/LingJing-1.56.0* /var/www/downloads/latest*.yml 2>/dev/null')
print('=== Download Files ===')
print(stdout.read().decode(errors='replace'))

# 2. Check versions.json
stdin,stdout,stderr = ssh.exec_command('python3 -c "\nimport json\nd=json.load(open(\"/var/www/html/versions.json\"))\nprint(\"Latest:\", d[\"latest\"])\nprint(\"Updated:\", d[\"updated\"])\nfor k,v in sorted(d[\"versions\"][0][\"files\"].items()):\n  print(f\"  {k}: {v.get(\"size\",0)} bytes\")\n"')
print('\n=== versions.json ===')
print(stdout.read().decode(errors='replace'))

# 3. Check web server responds
stdin,stdout,stderr = ssh.exec_command('curl -s -o /dev/null -w "%{http_code}" http://localhost/versions.json')
print('\n=== Web Server ===')
print('HTTP /versions.json:', stdout.read().decode().strip())

stdin,stdout,stderr = ssh.exec_command('curl -s -o /dev/null -w "%{http_code}" http://localhost/latest.yml')
print('HTTP /latest.yml:', stdout.read().decode().strip())

stdin,stdout,stderr = ssh.exec_command('curl -s -o /dev/null -w "%{http_code}" http://localhost/latest-linux.yml')
print('HTTP /latest-linux.yml:', stdout.read().decode().strip())

# 4. Check nginx status
stdin,stdout,stderr = ssh.exec_command('systemctl is-active nginx 2>/dev/null || echo nginx not checked')
print('\nNginx:', stdout.read().decode().strip())

ssh.close()
print('\n=== Production Verification Complete ===')
