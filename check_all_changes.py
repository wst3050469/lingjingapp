import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# List all modified tracked files (excluding dist)
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff --name-only')
print("=== Modified (unstaged) ===")
print(stdout.read().decode(errors='replace'))

stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff --cached --name-only')
print("\n=== Staged ===")
print(stdout.read().decode(errors='replace'))

stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff --name-only HEAD')
print("\n=== All changes vs HEAD ===")
print(stdout.read().decode(errors='replace'))

ssh.close()
