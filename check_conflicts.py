import subprocess, os
os.chdir('D:/lingjing/lingjing')
r = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=U'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print('Conflicted files:')
print(r.stdout)
