import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Check what src/constants.ts is
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && ls -la src/constants.ts && head -20 src/constants.ts')
print('=== src/constants.ts ===')
print(stdout.read().decode(errors='replace')[:1000])

# Delete it and retry merge
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && mv src/constants.ts /tmp/constants.ts.bak && git merge temp/v1.56.0-sync --no-edit 2>&1')
print('\n=== Merge after removing constants.ts ===')
print(stdout.read().decode(errors='replace')[:1000])

ssh.close()
