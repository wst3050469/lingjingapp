import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Resolve all conflicts with local version
files = ['mobile/app.json', 'package.json', 'packages/core/package.json', 
         'packages/electron/package.json', 'packages/renderer/package.json',
         'src/constants.ts']

for f in files:
    r = subprocess.run(['git', 'checkout', '--ours', f], capture_output=True, text=True, encoding='utf-8', errors='replace')
    r2 = subprocess.run(['git', 'add', f], capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(f'{f}: {"OK" if r2.returncode == 0 else r2.stderr}')

# Check if still conflicted
r = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=U'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print(f'\nRemaining conflicts: {r.stdout.strip() or "None"}')
