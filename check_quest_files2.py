import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Check if these files exist and search for changes
files = [
    'packages/electron/src/ipc/quest-ipc.ts',
    'packages/electron/src/preload.ts',
    'packages/renderer/src/types/electron.d.ts',
    'packages/renderer/src/hooks/useQuestEvents.ts',
    'packages/renderer/src/components/quest/QuestConversation.tsx',
    'packages/renderer/src/components/quest/QuestView.tsx',
]

for f in files:
    stdin, stdout, stderr = ssh.exec_command(f'cd /home/liuhui/lingjing && git diff HEAD -- "{f}" | wc -l')
    lines = stdout.read().decode(errors='replace').strip()
    stdin2, stdout2, stderr2 = ssh.exec_command(f'cd /home/liuhui/lingjing && test -f "{f}" && echo "EXISTS" || echo "NOT FOUND"')
    exists = stdout2.read().decode(errors='replace').strip()
    print(f"{f}: exists={exists}, diff_lines={lines}")

ssh.close()
