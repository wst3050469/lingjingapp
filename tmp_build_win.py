import subprocess, os

project_dir = 'D:/lingjing-ide/desktop/electron'
log_file = 'D:/lingjing-ide/build-log-17373.txt'

with open(log_file, 'w', encoding='utf-8') as log:
    log.write('=== build-main ===\n')
    r1 = subprocess.run(
        ['node', 'scripts/build-main.mjs'],
        cwd=project_dir,
        capture_output=True, text=True, encoding='utf-8', errors='replace'
    )
    log.write('STDOUT:\n' + r1.stdout + '\n')
    log.write('STDERR:\n' + r1.stderr + '\n')
    log.write('Return: ' + str(r1.returncode) + '\n\n')
    
    if r1.returncode != 0:
        print('build-main FAILED')
        exit(1)
    
    log.write('=== electron-builder ===\n')
    r2 = subprocess.run(
        ['node', 'node_modules/electron-builder/cli.js', '--win', '--x64', '--publish', 'never'],
        cwd=project_dir,
        capture_output=True, text=True, encoding='utf-8', errors='replace',
        timeout=1800  # 30 min timeout
    )
    log.write('STDOUT:\n' + r2.stdout + '\n')
    log.write('STDERR:\n' + r2.stderr + '\n')
    log.write('Return: ' + str(r2.returncode) + '\n')

print('Done. Check build-log-17373.txt')
