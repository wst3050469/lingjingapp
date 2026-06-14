import subprocess, os, sys

project_dir = 'D:/lingjing-ide/desktop/electron'
log_file = 'D:/lingjing-ide/build-log-17373-part2.txt'

# Only run electron-builder, build-main already succeeded
with open(log_file, 'w', encoding='utf-8') as log:
    log.write('=== electron-builder (2nd attempt) ===\n')
    r = subprocess.run(
        ['node', 'node_modules/electron-builder/cli.js', '--win', '--x64', '--publish', 'never'],
        cwd=project_dir,
        capture_output=True, text=True, encoding='utf-8', errors='replace',
        timeout=3600  # 60 min timeout
    )
    log.write('STDOUT:\n' + r.stdout + '\n')
    log.write('STDERR:\n' + r.stderr + '\n')
    log.write('Return: ' + str(r.returncode) + '\n')

print('Return code:', r.returncode)
print('Check build-log-17373-part2.txt')
