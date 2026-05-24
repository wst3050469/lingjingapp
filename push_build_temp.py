import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Push to a temp branch on build server
r = subprocess.run(['git', 'push', 'build', 'main:refs/heads/temp/v1.56.0-sync'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
print('push to build (temp branch):')
print('stdout:', r.stdout[:300] if r.stdout else '')
print('stderr:', r.stderr[:500] if r.stderr else '')
print('returncode:', r.returncode)
