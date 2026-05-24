import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Commit temp file cleanup first
r = subprocess.run(['git', 'add', '-A'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print(f'git add: {r.returncode}')

r = subprocess.run(['git', 'commit', '-m', 'chore: remove temp diagnostic scripts'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print(f'git commit: {r.returncode}')
print(r.stdout[:200] if r.stdout else '')

# Now run filter-branch
print('\nRunning git filter-branch...')
cmd = [
    'git', 'filter-branch', '--force', '--index-filter',
    'git rm --cached --ignore-unmatch -r packages/release/ lingjing-mobile-v1.52.12.apk',
    '--prune-empty', '--', '--all'
]
r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300)
print(f'returncode: {r.returncode}')
print('stdout:', r.stdout[-500:] if r.stdout else '')
if r.stderr:
    print('stderr:', r.stderr[-500:])
