import subprocess, os, time
os.chdir('D:/lingjing/lingjing')

# Commit temp file cleanup
subprocess.run(['git', 'add', '-A'], capture_output=True)

# First, use filter-branch to remove large files from ALL history
print('Running git filter-branch to remove large files from history...')
print('(This may take a while)')

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

print('\nDone')
