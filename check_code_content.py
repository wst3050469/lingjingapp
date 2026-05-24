import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)

# Check if quest-ipc.ts has getAgentStatus handler
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && grep -n "getAgentStatus\\|get-agent-status" packages/electron/src/ipc/quest-ipc.ts')
print("=== quest-ipc.ts getAgentStatus ===")
print(stdout.read().decode(errors='replace'))

# Check if preload.ts has getAgentStatus
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && grep -n "getAgentStatus" packages/electron/src/preload.ts')
print("\n=== preload.ts getAgentStatus ===")
print(stdout.read().decode(errors='replace'))

# Check electron.d.ts
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && grep -n "getAgentStatus" packages/renderer/src/types/electron.d.ts')
print("\n=== electron.d.ts getAgentStatus ===")
print(stdout.read().decode(errors='replace'))

# Check useQuestEvents for isLateLifecycleEvent
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && grep -n "isLateLifecycleEvent\\|lateLifecycle" packages/renderer/src/hooks/useQuestEvents.ts')
print("\n=== useQuestEvents.ts lifecycle guard ===")
print(stdout.read().decode(errors='replace'))

# Check QuestConversation for getAgentStatus
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && grep -n "getAgentStatus" packages/renderer/src/components/quest/QuestConversation.tsx')
print("\n=== QuestConversation.tsx getAgentStatus ===")
print(stdout.read().decode(errors='replace'))

# Check agent.ts for MAX_NO_TOOL_RETRIES
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && grep -n "MAX_NO_TOOL_RETRIES" packages/core/src/agent/agent.ts')
print("\n=== agent.ts MAX_NO_TOOL_RETRIES ===")
print(stdout.read().decode(errors='replace'))

# Check agent.ts for looksLikeTaskComplete
stdin, stdout, stderr = ssh.exec_command('cd /home/liuhui/lingjing && grep -n "INCOMPLETE_PATTERNS" packages/core/src/agent/agent.ts')
print("\n=== agent.ts INCOMPLETE_PATTERNS ===")
print(stdout.read().decode(errors='replace'))

ssh.close()
