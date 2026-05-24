import paramiko, json, os

HOST = '120.55.5.220'
USER = 'root'
PASS = 'WsT13575967132'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=10)

# Read remote versions.json
stdin, stdout, stderr = ssh.exec_command('cat /var/www/html/versions.json')
data = json.loads(stdout.read().decode())

# Add v1.56.0 entry
new_entry = {
    "version": "1.56.0",
    "releaseDate": "2026-05-24T12:08:38.955Z",
    "releaseNotes": "v1.56.0 - Fix: Quest Agent lifecycle management (return-not-responding + task interruption). MAX_NO_TOOL_RETRIES 3->5, Chinese task-complete false positive fix, IPC agent-status check, late lifecycle event guard.",
    "status": "published",
    "publishedAt": "2026-05-24T12:08:38.955Z",
    "features": [
        "MAX_NO_TOOL_RETRIES: 3 -> 5 (fewer false task-complete detections)",
        "Chinese looksLikeTaskComplete regex fix (added $ anchor to prevent false positives)",
        "IPC quest:get-agent-status channel for lifecycle detection",
        "getAgentStatus API in preload.ts + type declarations",
        "isLateLifecycleEvent guard in useQuestEvents (prevents stale done/error events from killing active runs)",
        "QuestConversation auto-resume multi-level fallback check",
        "QuestView simplified cleanup (removed duplicate auto-resume)"
    ],
    "files": {
        "win-x64": {
            "url": "LingJing-Setup-1.56.0-win-x64.exe",
            "size": 142153635,
            "sha512": "9828b0f737369727bacef7858f5cd5a0fedef2f9ecb41afea40a2f757d3ba9a93aa5b7ad13657908167cdd3d3a6b3690ea5b3770b4a6afc067192fbc9f7640c9"
        },
        "win-x64-portable": {
            "url": "LingJing-Portable-1.56.0-win-x64.exe",
            "size": 141812083,
            "sha512": "e20cc167a6f43d0f1c0aa8817637cddcdddb0d91755062e2e3e10eb916938ce346cc810057890a103dff8bd99e91c9a6d31ff280f3c8f9f330919af6d1ff5bc5"
        },
        "win-x64-blockmap": {
            "url": "LingJing-Setup-1.56.0-win-x64.exe.blockmap",
            "size": 149011
        },
        "android": {
            "url": "lingjing-mobile-v1.52.12.apk",
            "size": 81479178
        }
    }
}

# Insert at beginning of versions array
data['versions'].insert(0, new_entry)
data['latest'] = '1.56.0'
data['version'] = '1.56.0'
data['files'] = new_entry['files']
data['updated'] = '2026-05-24T12:08:38.955Z'

# Upload back
sftp = ssh.open_sftp()
with sftp.open('/var/www/html/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
sftp.close()

# Verify
stdin, stdout, stderr = ssh.exec_command('cat /var/www/html/versions.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(\'Latest:\', d[\'latest\']); print(\'Entries:\', len(d[\'versions\'])); print(\'First entry version:\', d[\'versions\'][0][\'version\'])"')
print(stdout.read().decode())

ssh.close()
print('versions.json updated successfully')
