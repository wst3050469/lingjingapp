import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Merge the temp branch into main on build server
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git merge temp/v1.56.0-sync --no-edit 2>&1')
out = stdout.read().decode(errors='replace')
err = stderr.read().decode(errors='replace')
print('merge output:', out)
print('merge stderr:', err)

# Check status
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git log --oneline -3')
print('\ngit log:')
print(stdout.read().decode(errors='replace'))

ssh.close()
