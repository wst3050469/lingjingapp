import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Check all changes including electron and renderer files
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff --name-only HEAD -- packages/electron/src/ packages/renderer/src/')
print("=== Electron + Renderer source changes ===")
print(stdout.read().decode(errors='replace'))

# Check the specific quest files
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff HEAD -- packages/electron/src/ipc/quest-ipc.ts 2>/dev/null | head -5 || echo "file not changed"')
print("\n=== quest-ipc.ts status ===")
print(stdout.read().decode(errors='replace'))

stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff HEAD -- packages/electron/src/preload.ts 2>/dev/null | head -5 || echo "file not changed"')
print("\n=== preload.ts status ===")
print(stdout.read().decode(errors='replace'))

stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff HEAD -- packages/renderer/src/types/electron.d.ts 2>/dev/null | head -5 || echo "file not changed"')
print("\n=== electron.d.ts status ===")
print(stdout.read().decode(errors='replace'))

stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff HEAD -- packages/renderer/src/hooks/useQuestEvents.ts 2>/dev/null | head -5 || echo "file not changed"')
print("\n=== useQuestEvents.ts status ===")
print(stdout.read().decode(errors='replace'))

stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff HEAD -- packages/renderer/src/components/quest/QuestConversation.tsx 2>/dev/null | head -5 || echo "file not changed"')
print("\n=== QuestConversation.tsx status ===")
print(stdout.read().decode(errors='replace'))

stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && git diff HEAD -- packages/renderer/src/components/quest/QuestView.tsx 2>/dev/null | head -5 || echo "file not changed"')
print("\n=== QuestView.tsx status ===")
print(stdout.read().decode(errors='replace'))

ssh.close()
