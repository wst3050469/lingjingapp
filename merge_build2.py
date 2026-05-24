import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Stash local changes, merge, pop stash
commands = [
    'cd /home/liuhui/lingjing && git stash',
    'cd /home/liuhui/lingjing && git merge temp/v1.56.0-sync --no-edit 2>&1',
    'cd /home/liuhui/lingjing && git stash pop 2>&1',
]

for cmd in commands:
    print(f'>>> {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode(errors='replace')
    err = stderr.read().decode(errors='replace')
    print(out[:1000] if out else '')
    if err.strip():
        print('err:', err[:500])

# Final status
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git log --oneline -3')
print('\n=== Final git log ===')
print(stdout.read().decode(errors='replace'))

ssh.close()
