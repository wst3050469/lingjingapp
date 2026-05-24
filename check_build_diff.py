import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Check diff for key files
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff packages/core/src/agent/agent.ts | head -80')
print("=== agent.ts diff ===")
print(stdout.read().decode(errors='replace'))

# Check package.json version
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && python3 -c "import json; print(json.load(open(\'package.json\'))[\'version\'])"')
print(f"\n=== package.json version: {stdout.read().decode(errors='replace').strip()} ===")

ssh.close()
