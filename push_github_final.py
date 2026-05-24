import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Create a commit removing large files
r = subprocess.run(['git', 'add', '-A'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print(f'git add -A: returncode={r.returncode}')

r = subprocess.run(['git', 'commit', '-m', 'chore: remove large build artifacts from git tracking (packages/release/, *.apk)'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print(f'commit: returncode={r.returncode}')
print(r.stdout[:300] if r.stdout else '')

# Cleanup old large files from history using filter-branch
# First, let's try pushing to see if GitHub rejects it
r = subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
print(f'\npush to GitHub: returncode={r.returncode}')
print('stdout:', r.stdout[:500] if r.stdout else '')
print('stderr:', r.stderr[:500] if r.stderr else '')
