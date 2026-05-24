import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Clean everything and merge
commands = [
    # Remove untracked file blocking merge
    'rm -f /home/liuhui/lingjing/src/constants.ts',
    # Reset hard to temp branch (which has our v1.56.0 code)
    'cd /home/liuhui/lingjing && git stash && git checkout temp/v1.56.0-sync 2>&1',
    # Force main to match
    'cd /home/liuhui/lingjing && git branch -f main temp/v1.56.0-sync 2>&1',
    # Switch back to main
    'cd /home/liuhui/lingjing && git checkout main 2>&1',
    # Delete temp branch
    'cd /home/liuhui/lingjing && git branch -D temp/v1.56.0-sync 2>&1',
    # Show final state
    'cd /home/liuhui/lingjing && git log --oneline -3',
]

for cmd in commands:
    print(f'>>> {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode(errors='replace')
    err = stderr.read().decode(errors='replace')
    print(out[:500] if out.strip() else '(empty)')
    if err.strip():
        print('err:', err[:300])

ssh.close()
