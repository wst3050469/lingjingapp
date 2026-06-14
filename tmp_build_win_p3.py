# -*- coding: utf-8 -*-
import subprocess, sys, io

# Force UTF-8 for stdout/stderr
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

project_dir = 'D:/lingjing-ide/desktop/electron'
log_file = 'D:/lingjing-ide/build-log-17374.txt'

with open(log_file, 'w', encoding='utf-8') as log:
    log.write('=== electron-builder (release-v17374) ===\n')
    log.flush()
    
    r = subprocess.run(
        ['node', 'node_modules/electron-builder/cli.js', '--win', '--x64', '--publish', 'never'],
        cwd=project_dir,
        capture_output=True, text=True, encoding='utf-8', errors='replace',
        timeout=3600
    )
    log.write('STDOUT:\n' + r.stdout + '\n')
    log.write('STDERR:\n' + r.stderr + '\n')
    log.write('Return: ' + str(r.returncode) + '\n')
    log.flush()

print('Return code:', r.returncode, flush=True)
print('Check build-log-17374.txt', flush=True)
