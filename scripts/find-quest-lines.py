#!/usr/bin/env python3
import os
os.chdir('D:/lingjing/lingjing')
with open('packages/electron/src/ipc/quest-ipc.ts', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if any(kw in line for kw in ['taskAgents.set', "quest:run'", 'quest:abort', 'quest:pause', 'quest:resume', "ipcMain.handle('quest"]):
            print(f'{i}: {line.rstrip()[:120]}')
