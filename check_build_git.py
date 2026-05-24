import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Check git log on build server
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git log --oneline -10')
print("=== Build server git log ===")
print(stdout.read().decode(errors='replace'))

# Check if v1.56.0 commit exists
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git log --oneline --all | grep "1.56.0\\|57d178\\|0ff23d"')
out = stdout.read().decode(errors='replace')
if out.strip():
    print("=== v1.56.0 commits found ===")
    print(out)
else:
    print("=== No v1.56.0 commits found ===")

# Check git status
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git status --short')
print("\n=== Git status ===")
print(stdout.read().decode(errors='replace'))

# Check remote
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git remote -v')
print("\n=== Remotes ===")
print(stdout.read().decode(errors='replace'))

ssh.close()
