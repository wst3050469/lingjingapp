import paramiko
import os
import stat

LOCAL_REPO = r'D:\lingjing\lingjing'
REMOTE_REPO = '/home/liuhui/lingjing'

# Files that were modified (source only, not dist)
CHANGED_FILES = [
    'packages/core/src/agent/agent.ts',
    'packages/electron/src/ipc/quest-ipc.ts',
    'packages/electron/src/preload.ts',
    'packages/renderer/src/types/electron.d.ts',
    'packages/renderer/src/hooks/useQuestEvents.ts',
    'packages/renderer/src/components/quest/QuestConversation.tsx',
    'packages/renderer/src/components/quest/QuestView.tsx',
]

# Also need dist files for agent.ts since the build server may not rebuild core
DIST_FILES = [
    'packages/core/dist/agent/agent.js',
    'packages/core/dist/agent/agent.js.map',
    'packages/core/dist/agent/agent.d.ts',
    'packages/core/dist/agent/agent.d.ts.map',
]

print('Connecting to build server...')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.1.9', username='liuhui', password='liu201314', timeout=10)
sftp = ssh.open_sftp()

try:
    # Sync changed source files
    for f in CHANGED_FILES:
        local = os.path.join(LOCAL_REPO, f)
        remote = os.path.join(REMOTE_REPO, f)
        if os.path.exists(local):
            # Ensure remote directory exists
            remote_dir = os.path.dirname(remote)
            stdin, stdout, stderr = ssh.exec_command('mkdir -p ' + remote_dir)
            stdout.channel.recv_exit_status()
            
            print('Syncing ' + f)
            sftp.put(local, remote)
        else:
            print('SKIP (not found): ' + f)
    
    # Sync dist files for agent.ts
    for f in DIST_FILES:
        local = os.path.join(LOCAL_REPO, f)
        remote = os.path.join(REMOTE_REPO, f)
        if os.path.exists(local):
            remote_dir = os.path.dirname(remote)
            stdin, stdout, stderr = ssh.exec_command('mkdir -p ' + remote_dir)
            stdout.channel.recv_exit_status()
            
            print('Syncing ' + f)
            sftp.put(local, remote)
        else:
            print('SKIP (not found): ' + f)
    
    print('\nFiles synced. Now building Linux...')
    
    # Build core package first
    stdin,stdout,stderr = ssh.exec_command('cd ' + REMOTE_REPO + '/packages/core && npx tsc 2>&1')
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print('Core build output:', out[:500])
    if err: print('Core build errors:', err[:500])
    
    # Build electron main process
    stdin,stdout,stderr = ssh.exec_command('cd ' + REMOTE_REPO + '/packages/electron && node scripts/build-main.mjs 2>&1')
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out: print('Electron build output:', out[:500])
    if err: print('Electron build errors:', err[:500])
    
    # Build Linux distribution
    print('\nBuilding Linux AppImage (this may take a while)...')
    stdin,stdout,stderr = ssh.exec_command('cd ' + REMOTE_REPO + '/packages/electron && node scripts/build-main.mjs && node scripts/pre-package.mjs && npx electron-builder build --linux --x64 2>&1')
    
    # Read output in chunks to avoid timeout
    import select
    import time
    
    start = time.time()
    while True:
        if stdout.channel.exit_status_ready():
            break
        if time.time() - start > 600:  # 10 minute timeout
            print('TIMEOUT: Linux build taking too long')
            break
        if stdout.channel.recv_ready():
            data = stdout.channel.recv(4096).decode()
            print(data, end='')
        time.sleep(1)
    
    # Get any remaining output
    remaining = stdout.read().decode()
    if remaining:
        print(remaining)
    
    print('\nLinux build completed')
    
    # Check for Linux artifacts
    stdin,stdout,stderr = ssh.exec_command('ls -la ' + REMOTE_REPO + '/packages/electron/release/*.AppImage ' + REMOTE_REPO + '/packages/electron/release/*.deb 2>/dev/null')
    print(stdout.read().decode())

finally:
    sftp.close()
    ssh.close()
